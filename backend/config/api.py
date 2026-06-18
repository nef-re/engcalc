from typing import Any

from django.http import HttpRequest
from ninja import NinjaAPI, Schema
from ninja.errors import HttpError

from calculators.models import CalculationRun, CalculatorDefinition
from calculators.registry import get_calculator, list_calculators
from catalog.models import Cable, CircuitBreaker, InstallationCondition, Fan, Transformer
from electrical.defaults import get_system_defaults
from electrical.models import ElectricalSystem
from electrical.system_engine import calculate_system, default_mkd_template
from projects.models import Project

api = NinjaAPI(title="Engineering Portal API", version="1.0")


class CalculateIn(Schema):
    data: dict[str, Any]
    project_id: int | None = None


class ProjectIn(Schema):
    name: str
    client: str = ""
    address: str = ""


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


@api.get("/catalog/cables/")
def catalog_cables(
    request: HttpRequest,
    section_min: float | None = None,
    material: str | None = None,
):
    qs = Cable.objects.select_related("brand")
    if section_min is not None:
        qs = qs.filter(section_mm2__gte=section_min)
    if material:
        qs = qs.filter(material=material)
    return [
        {
            "id": c.id,
            "name": c.name,
            "brand": c.brand.name,
            "section_mm2": c.section_mm2,
            "material": c.material,
            "u_max_v": c.u_max_v,
            "i_long_a": c.i_long_a,
            "r_mohm_per_m": c.r_mohm_per_m,
            "r_20_mohm_per_m": c.r_20_mohm_per_m,
            "x_mohm_per_m": c.x_mohm_per_m,
            "outer_diameter_mm": c.outer_diameter_mm,
            "min_bend_radius_mm": c.min_bend_radius_mm,
            "pe_core_section_mm2": c.pe_core_section_mm2,
            "gost_ref": c.gost_ref,
        }
        for c in qs[:100]
    ]


@api.get("/catalog/breakers/")
def catalog_breakers(request: HttpRequest, in_min: float | None = None):
    qs = CircuitBreaker.objects.all()
    if in_min is not None:
        qs = qs.filter(in_a__gte=in_min)
    return [
        {
            "id": b.id,
            "manufacturer": b.manufacturer,
            "model_name": b.model_name,
            "breaker_type": b.breaker_type,
            "in_a": b.in_a,
            "icu_ka": b.icu_ka,
            "ics_ka": b.ics_ka,
            "u_e_v": b.u_e_v,
            "u_imp_kv": b.u_imp_kv,
            "curve": b.curve,
            "poles": b.poles,
            "gost_ref": b.gost_ref,
        }
        for b in qs[:100]
    ]


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
    qs = Project.objects.all()[:50]
    return [
        {
            "id": p.id,
            "name": p.name,
            "client": p.client,
            "address": p.address,
            "updated_at": p.updated_at.isoformat(),
        }
        for p in qs
    ]


@api.post("/projects/")
def projects_create(request: HttpRequest, payload: ProjectIn):
    project = Project.objects.create(
        name=payload.name,
        client=payload.client,
        address=payload.address,
        owner=request.user if request.user.is_authenticated else None,
    )
    return {"id": project.id, "name": project.name}


class SystemIn(Schema):
    name: str = "МКД — типовая схема"
    graph_data: dict[str, Any] | None = None
    u_nom_v: float = 400
    z_source_mohm: float = 10.0
    project_id: int | None = None


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
    graph = payload.graph_data or default_mkd_template()
    result = calculate_system(graph, payload.u_nom_v, payload.z_source_mohm)
    return result


@api.get("/electrical/systems/")
def systems_list(request: HttpRequest):
    return [
        {
            "id": s.id,
            "name": s.name,
            "u_nom_v": s.u_nom_v,
            "updated_at": s.updated_at.isoformat(),
        }
        for s in ElectricalSystem.objects.all()[:50]
    ]


@api.post("/electrical/systems/")
def systems_create(request: HttpRequest, payload: SystemIn):
    graph = payload.graph_data or default_mkd_template()
    result = calculate_system(graph, payload.u_nom_v, payload.z_source_mohm)
    system = ElectricalSystem.objects.create(
        name=payload.name,
        project_id=payload.project_id,
        u_nom_v=payload.u_nom_v,
        z_source_mohm=payload.z_source_mohm,
        graph_data=graph,
        last_result=result,
    )
    return {"id": system.id, "name": system.name, "result": result}


@api.get("/electrical/systems/{system_id}/")
def systems_get(request: HttpRequest, system_id: int):
    try:
        s = ElectricalSystem.objects.get(pk=system_id)
    except ElectricalSystem.DoesNotExist:
        raise HttpError(404, "System not found")
    return {
        "id": s.id,
        "name": s.name,
        "graph_data": s.graph_data,
        "u_nom_v": s.u_nom_v,
        "z_source_mohm": s.z_source_mohm,
        "last_result": s.last_result,
    }
