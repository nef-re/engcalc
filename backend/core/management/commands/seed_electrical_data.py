from django.core.management.base import BaseCommand

from calculators.models import CalculatorDefinition
from catalog.models import Cable, CircuitBreaker
from core.models import StandardReference

STANDARDS = [
    ("PUE-7", "Правила устройства электроустановок", "гл. 1.2–1.8", "Базовые требования к НН сетям"),
    ("GOST-R-50571", "ГОСТ Р 50571 (IEC 60364)", "части 4–5", "Электроустановки низкого напряжения"),
    ("GOST-R-50345", "ГОСТ Р 50345-2010", "", "Автоматические выключатели бытового назначения"),
    ("GOST-R-50030-2", "ГОСТ Р 50030.2 (IEC 60947-2)", "", "Автоматические выключатели пром. назначения"),
    ("GOST-31996", "ГОСТ 31996-2012", "", "Кабели силовые с пластмассовой изоляцией 0.66/1 кВ"),
    ("GOST-R-50571-4-41", "ГОСТ Р 50571.4.41", "", "Защита от поражения электрическим током"),
    ("GOST-R-50571-4-43", "ГОСТ Р 50571.4.43", "п. 430", "Защита от сверхтоков"),
    ("SP-256", "СП 256.1325800.2016", "", "Электроустановки жилых и общественных зданий"),
]

CALCULATOR_STANDARDS = {
    "electrical.load": ["PUE-7", "GOST-R-50571"],
    "electrical.cable_section": ["PUE-7", "GOST-31996", "GOST-R-50571-4-43"],
    "electrical.voltage_drop": ["PUE-7", "GOST-R-50571"],
    "electrical.short_circuit": ["PUE-7", "GOST-R-50571-4-41", "GOST-R-50571-4-43"],
    "electrical.breaker_selection": ["PUE-7", "GOST-R-50345", "GOST-R-50030-2"],
    "electrical.system": ["PUE-7", "GOST-R-50571", "SP-256", "GOST-31996", "GOST-R-50345"],
}

CABLE_DIAMETERS = {
    1.5: (9.0, 67.5),
    2.5: (10.5, 78.75),
    4.0: (12.0, 90.0),
    6.0: (13.5, 101.25),
    10.0: (16.0, 120.0),
    16.0: (18.5, 138.75),
    25.0: (22.0, 165.0),
}


class Command(BaseCommand):
    help = "Загрузить нормативы и обновить каталог кабелей/автоматов"

    def handle(self, *args, **options):
        refs = {}
        for code, title, clause, desc in STANDARDS:
            ref, _ = StandardReference.objects.update_or_create(
                code=code,
                defaults={"title": title, "clause": clause, "description": desc},
            )
            refs[code] = ref
            self.stdout.write(f"  Standard: {code}")

        from calculators.registry import get_calculator

        for slug, std_codes in CALCULATOR_STANDARDS.items():
            calc = get_calculator(slug)
            if not calc:
                continue
            defn, _ = CalculatorDefinition.objects.update_or_create(
                slug=slug,
                defaults={
                    "discipline": calc.discipline,
                    "name": calc.name,
                    "description": calc.description,
                    "order": calc.order,
                    "standard_ref": calc.standard_ref,
                    "is_active": True,
                },
            )
            defn.standards.set([refs[c] for c in std_codes if c in refs])

        for cable in Cable.objects.all():
            diam = CABLE_DIAMETERS.get(cable.section_mm2)
            if diam:
                cable.outer_diameter_mm = diam[0]
                cable.min_bend_radius_mm = diam[1]
            if not cable.r_20_mohm_per_m:
                cable.r_20_mohm_per_m = cable.r_mohm_per_m
            if not cable.n_core_section_mm2:
                cable.n_core_section_mm2 = cable.section_mm2
            if not cable.pe_core_section_mm2:
                cable.pe_core_section_mm2 = cable.section_mm2
            cable.u_max_v = 1000
            cable.save()

        for br in CircuitBreaker.objects.all():
            if not br.ics_ka:
                br.ics_ka = br.icu_ka * 0.75
            if not br.breaker_type:
                br.breaker_type = "MCB"
            br.save()

        self.stdout.write(self.style.SUCCESS("Done: standards + catalog updated"))
