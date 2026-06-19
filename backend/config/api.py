from typing import Any

from django.http import HttpRequest
from ninja import NinjaAPI, Schema
from ninja.errors import HttpError

from calculators.models import CalculationRun, CalculatorDefinition
from calculators.registry import get_calculator, list_calculators
from catalog.display import cable_display_name
from catalog.models import Cable, CableBrand, CircuitBreaker, InstallationCondition, Fan, Transformer
from electrical.defaults import get_system_defaults
from electrical.models import ElectricalSystem
from electrical.system_engine import calculate_system, default_mkd_template
from projects.models import Project
from users.auth import create_token, get_user_from_request, login_user, register_user, require_auth

api = NinjaAPI(title="Engineering Portal API", version="1.0")


class CalculateIn(Schema):
    data: dict[str, Any]
    project_id: int | None = None


class ProjectIn(Schema):
    name: str
    client: str = ""
    address: str = ""


class RegisterIn(Schema):
    username: str
    email: str = ""
    password: str


class LoginIn(Schema):
    username: str
    password: str


def _user_payload(user) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
    }


@api.post("/auth/register/")
def auth_register(request: HttpRequest, payload: RegisterIn):
    if len(payload.password) < 6:
        raise HttpError(400, "Password must be at least 6 characters")
    user = register_user(payload.username, payload.email, payload.password)
    token = create_token(user)
    return {"token": token, "user": _user_payload(user)}


@api.post("/auth/login/")
def auth_login(request: HttpRequest, payload: LoginIn):
    user = login_user(payload.username, payload.password)
    token = create_token(user)
    return {"token": token, "user": _user_payload(user)}


@api.get("/auth/me/")
def auth_me(request: HttpRequest):
    user = require_auth(request)
    return _user_payload(user)


@api.get("/calculators/")
def calculators_list(request: HttpRequest, discipline: str | None = None):
    return list_calculators(discipline)


@api.get("/calculators/{slug}/schema/")
def calculator_schema(request: HttpRequest, slug: str):
    calc = get_calculator(slug)
    if not calc:
        raise HttpError(404, "Calculator not found")
    return calc.input_schema()


@api.get("/calculators/{slug}/standards/")
def calculator_standards(request: HttpRequest, slug: str):
    from calculators.models import CalculatorDefinition

    try:
        defn = CalculatorDefinition.objects.prefetch_related("standards").get(slug=slug)
    except CalculatorDefinition.DoesNotExist:
        calc = get_calculator(slug)
        if not calc:
            raise HttpError(404, "Calculator not found")
        return {"standards": [], "standard_ref": calc.standard_ref}

    return {
        "standard_ref": defn.standard_ref,
        "standards": [
            {
                "code": s.code,
                "title": s.title,
                "clause": s.clause,
                "description": s.description,
            }
            for s in defn.standards.all()
        ],
    }


@api.post("/calculators/{slug}/calculate/")
def calculator_calculate(request: HttpRequest, slug: str, payload: CalculateIn):
    calc = get_calculator(slug)
    if not calc:
        raise HttpError(404, "Calculator not found")

    warnings_extra = calc.validate(payload.data)
    output = calc.calculate(payload.data)
    output["warnings"] = warnings_extra + output.get("warnings", [])

    if payload.project_id:
        try:
            project = Project.objects.get(pk=payload.project_id)
            defn, _ = CalculatorDefinition.objects.get_or_create(
                slug=slug,
                defaults={
                    "discipline": calc.discipline,
                    "name": calc.name,
                    "description": calc.description,
                    "order": calc.order,
                    "standard_ref": calc.standard_ref,
                },
            )
            CalculationRun.objects.create(
                calculator=defn,
                project=project,
                user=request.user if request.user.is_authenticated else None,
                input_data=payload.data,
                result_data=output,
            )
        except Project.DoesNotExist:
            pass

    return output


def _cable_payload(c: Cable) -> dict:
    return {
        "id": c.id,
        "name": cable_display_name(c),
        "brand": c.brand.name,
        "construction": c.construction,
        "section_mm2": c.section_mm2,
        "cores": c.cores,
        "material": c.material,
        "u_max_v": c.u_max_v,
        "i_long_a": c.i_long_a,
        "r_mohm_per_m": c.r_mohm_per_m,
        "r_20_mohm_per_m": c.r_20_mohm_per_m,
        "temp_coeff": c.temp_coeff,
        "x_mohm_per_m": c.x_mohm_per_m,
        "outer_diameter_mm": c.outer_diameter_mm,
        "min_bend_radius_mm": c.min_bend_radius_mm,
        "n_core_section_mm2": c.n_core_section_mm2,
        "pe_core_section_mm2": c.pe_core_section_mm2,
        "mass_kg_per_m": c.mass_kg_per_m,
        "gost_ref": c.gost_ref,
    }


@api.get("/catalog/cables/")
def catalog_cables(
    request: HttpRequest,
    section_min: float | None = None,
    section_max: float | None = None,
    material: str | None = None,
    brand: str | None = None,
    gost: str | None = None,
    construction: str | None = None,
):
    qs = Cable.objects.select_related("brand")
    if section_min is not None:
        qs = qs.filter(section_mm2__gte=section_min)
    if section_max is not None:
        qs = qs.filter(section_mm2__lte=section_max)
    if material:
        qs = qs.filter(material=material)
    if brand:
        qs = qs.filter(brand__name__icontains=brand)
    if gost:
        qs = qs.filter(gost_ref__icontains=gost)
    if construction:
        qs = qs.filter(construction=construction)
    return [_cable_payload(c) for c in qs[:500]]


@api.get("/catalog/cables/{cable_id}/")
def catalog_cable_detail(request: HttpRequest, cable_id: int):
    try:
        c = Cable.objects.select_related("brand").get(pk=cable_id)
    except Cable.DoesNotExist:
        raise HttpError(404, "Cable not found")
    return _cable_payload(c)


@api.get("/catalog/cables/brands/")
def catalog_cable_brands(request: HttpRequest):
    return [
        {"id": b.id, "name": b.name, "description": b.description}
        for b in CableBrand.objects.all()
    ]


def _breaker_payload(b: CircuitBreaker) -> dict:
    return {
        "id": b.id,
        "manufacturer": b.manufacturer,
        "series": b.series,
        "model_name": b.model_name,
        "category": b.category,
        "breaker_type": b.breaker_type,
        "in_a": b.in_a,
        "icu_ka": b.icu_ka,
        "ics_ka": b.ics_ka,
        "u_e_v": b.u_e_v,
        "u_imp_kv": b.u_imp_kv,
        "curve": b.curve,
        "poles": b.poles,
        "has_rcd": b.has_rcd,
        "rcd_type": b.rcd_type,
        "rcd_in_ma": b.rcd_in_ma,
        "gost_ref": b.gost_ref,
    }


@api.get("/catalog/breakers/")
def catalog_breakers(
    request: HttpRequest,
    in_min: float | None = None,
    in_max: float | None = None,
    manufacturer: str | None = None,
    category: str | None = None,
    series: str | None = None,
    curve: str | None = None,
    poles: int | None = None,
    breaker_type: str | None = None,
):
    qs = CircuitBreaker.objects.all()
    if in_min is not None:
        qs = qs.filter(in_a__gte=in_min)
    if in_max is not None:
        qs = qs.filter(in_a__lte=in_max)
    if manufacturer:
        qs = qs.filter(manufacturer__icontains=manufacturer)
    if category:
        qs = qs.filter(category=category)
    if series:
        qs = qs.filter(series__icontains=series)
    if curve:
        qs = qs.filter(curve=curve)
    if poles is not None:
        qs = qs.filter(poles=poles)
    if breaker_type:
        qs = qs.filter(breaker_type=breaker_type)
    return [_breaker_payload(b) for b in qs[:500]]


@api.get("/catalog/breakers/meta/")
def catalog_breakers_meta(request: HttpRequest):
    qs = CircuitBreaker.objects.all()
    return {
        "manufacturers": sorted(qs.values_list("manufacturer", flat=True).distinct()),
        "series": sorted(qs.exclude(series="").values_list("series", flat=True).distinct()),
    }


@api.get("/catalog/breakers/{breaker_id}/")
def catalog_breaker_detail(request: HttpRequest, breaker_id: int):
    try:
        b = CircuitBreaker.objects.get(pk=breaker_id)
    except CircuitBreaker.DoesNotExist:
        raise HttpError(404, "Breaker not found")
    return _breaker_payload(b)


@api.get("/catalog/installations/")
def catalog_installations(request: HttpRequest):
    return [
        {
            "id": i.id,
            "name": i.name,
            "group_code": i.group_code,
            "k_temp": i.k_temp,
            "k_group": i.k_group,
        }
        for i in InstallationCondition.objects.all()
    ]


@api.get("/catalog/fans/")
def catalog_fans(request: HttpRequest):
    return [
        {
            "id": f.id,
            "manufacturer": f.manufacturer,
            "model_name": f.model_name,
            "q_max_m3h": f.q_max_m3h,
            "p_max_pa": f.p_max_pa,
        }
        for f in Fan.objects.all()[:50]
    ]


@api.get("/projects/")
def projects_list(request: HttpRequest):
    user = get_user_from_request(request)
    qs = Project.objects.all()
    if user:
        qs = qs.filter(owner=user)
    else:
        qs = qs.none()
    return [
        {
            "id": p.id,
            "name": p.name,
            "client": p.client,
            "address": p.address,
            "updated_at": p.updated_at.isoformat(),
        }
        for p in qs[:50]
    ]


@api.post("/projects/")
def projects_create(request: HttpRequest, payload: ProjectIn):
    user = require_auth(request)
    project = Project.objects.create(
        name=payload.name,
        client=payload.client,
        address=payload.address,
        owner=user,
    )
    return {"id": project.id, "name": project.name}


class SystemIn(Schema):
    name: str = "МКД — типовая схема"
    graph_data: dict[str, Any] | None = None
    u_nom_v: float = 400
    z_source_mohm: float = 10.0
    project_id: int | None = None


class SystemUpdateIn(Schema):
    name: str | None = None
    graph_data: dict[str, Any] | None = None
    u_nom_v: float | None = None
    z_source_mohm: float | None = None


def _system_payload(s: ElectricalSystem, include_graph: bool = False) -> dict:
    data = {
        "id": s.id,
        "name": s.name,
        "u_nom_v": s.u_nom_v,
        "z_source_mohm": s.z_source_mohm,
        "updated_at": s.updated_at.isoformat(),
        "last_result": s.last_result,
    }
    if include_graph:
        data["graph_data"] = s.graph_data
    return data


@api.get("/electrical/system/template/")
def system_template(request: HttpRequest):
    return default_mkd_template()


@api.get("/electrical/system/defaults/")
def system_defaults(request: HttpRequest):
    return get_system_defaults()


@api.get("/catalog/transformers/")
def catalog_transformers(request: HttpRequest):
    return [
        {
            "id": t.id,
            "name": t.name,
            "s_kva": t.s_kva,
            "u_primary_kv": t.u_primary_kv,
            "u_secondary_v": t.u_secondary_v,
            "uk_percent": t.uk_percent,
        }
        for t in Transformer.objects.all()
    ]


@api.post("/electrical/system/calculate/")
def system_calculate(request: HttpRequest, payload: SystemIn):
    require_auth(request)
    graph = payload.graph_data or default_mkd_template()
    result = calculate_system(graph, payload.u_nom_v, payload.z_source_mohm)
    return result


@api.get("/electrical/systems/")
def systems_list(request: HttpRequest):
    user = require_auth(request)
    return [_system_payload(s) for s in ElectricalSystem.objects.filter(owner=user)[:50]]


@api.post("/electrical/systems/")
def systems_create(request: HttpRequest, payload: SystemIn):
    user = require_auth(request)
    graph = payload.graph_data or default_mkd_template()
    result = calculate_system(graph, payload.u_nom_v, payload.z_source_mohm)
    system = ElectricalSystem.objects.create(
        name=payload.name,
        owner=user,
        project_id=payload.project_id,
        u_nom_v=payload.u_nom_v,
        z_source_mohm=payload.z_source_mohm,
        graph_data=graph,
        last_result=result,
    )
    return {**_system_payload(system, include_graph=True), "result": result}


@api.get("/electrical/systems/{system_id}/")
def systems_get(request: HttpRequest, system_id: int):
    user = require_auth(request)
    try:
        s = ElectricalSystem.objects.get(pk=system_id, owner=user)
    except ElectricalSystem.DoesNotExist:
        raise HttpError(404, "System not found")
    return _system_payload(s, include_graph=True)


@api.put("/electrical/systems/{system_id}/")
def systems_update(request: HttpRequest, system_id: int, payload: SystemUpdateIn):
    user = require_auth(request)
    try:
        s = ElectricalSystem.objects.get(pk=system_id, owner=user)
    except ElectricalSystem.DoesNotExist:
        raise HttpError(404, "System not found")
    graph = payload.graph_data if payload.graph_data is not None else s.graph_data
    u_nom = payload.u_nom_v if payload.u_nom_v is not None else s.u_nom_v
    z_src = payload.z_source_mohm if payload.z_source_mohm is not None else s.z_source_mohm
    result = calculate_system(graph, u_nom, z_src)
    if payload.name is not None:
        s.name = payload.name
    s.graph_data = graph
    s.u_nom_v = u_nom
    s.z_source_mohm = z_src
    s.last_result = result
    s.save()
    return {**_system_payload(s, include_graph=True), "result": result}


@api.delete("/electrical/systems/{system_id}/")
def systems_delete(request: HttpRequest, system_id: int):
    user = require_auth(request)
    deleted, _ = ElectricalSystem.objects.filter(pk=system_id, owner=user).delete()
    if not deleted:
        raise HttpError(404, "System not found")
    return {"ok": True}
