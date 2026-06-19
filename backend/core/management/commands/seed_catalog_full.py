from django.core.management.base import BaseCommand

from catalog.data.breaker_catalog import generate_breakers
from catalog.data.cable_specs import CABLE_BRANDS, generate_cables
from catalog.models import Cable, CableBrand, CircuitBreaker, InstallationCondition


class Command(BaseCommand):
    help = "Полный каталог: кабели по ГОСТ (без производителей) + аппараты IEK/Dekraft/КЭАЗ/EKF/Контактор"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Удалить существующие кабели и автоматы перед загрузкой",
        )

    def handle(self, *args, **options):
        if options["reset"]:
            self.stdout.write("Удаление старых записей каталога…")
            Cable.objects.all().delete()
            CircuitBreaker.objects.all().delete()
            CableBrand.objects.all().delete()

        # Марки кабелей
        allowed_brands = {spec["name"] for spec in CABLE_BRANDS}
        brand_map: dict[str, CableBrand] = {}
        for spec in CABLE_BRANDS:
            brand, _ = CableBrand.objects.update_or_create(
                name=spec["name"],
                defaults={"description": f"{spec['description']}. {spec['gost']}"},
            )
            brand_map[spec["name"]] = brand

        removed_orphans = Cable.objects.exclude(brand__name__in=allowed_brands).delete()
        removed_brands = CableBrand.objects.exclude(name__in=allowed_brands).delete()

        # Кабели (ключ: марка + исполнение + сечение)
        cable_items = generate_cables()
        created_cables = 0
        for item in cable_items:
            brand = brand_map[item["brand_name"]]
            _, created = Cable.objects.update_or_create(
                brand=brand,
                construction=item["construction"],
                section_mm2=item["section_mm2"],
                defaults={
                    "name": item["name"],
                    "cores": item["cores"],
                    "material": item["material"],
                    "u_max_v": item["u_max_v"],
                    "r_mohm_per_m": item["r_mohm_per_m"],
                    "r_20_mohm_per_m": item["r_20_mohm_per_m"],
                    "temp_coeff": item["temp_coeff"],
                    "x_mohm_per_m": item["x_mohm_per_m"],
                    "i_long_a": item["i_long_a"],
                    "outer_diameter_mm": item["outer_diameter_mm"],
                    "min_bend_radius_mm": item["min_bend_radius_mm"],
                    "n_core_section_mm2": item["n_core_section_mm2"],
                    "pe_core_section_mm2": item["pe_core_section_mm2"],
                    "mass_kg_per_m": item["mass_kg_per_m"],
                    "gost_ref": item["gost_ref"],
                },
            )
            if created:
                created_cables += 1

        removed_vvg_1c = Cable.objects.filter(
            brand__name__startswith="ВВГ", construction="1x"
        ).delete()

        # Условия прокладки (расширенный набор)
        install_data = [
            ("G1", "В воздухе, +25°C, группа 1", 25, 1.0, 1.0),
            ("G2", "В трубе, +25°C, группа 2", 25, 1.0, 0.85),
            ("G3", "На стене, +25°C, группа 3", 25, 1.0, 0.88),
            ("G4", "В земле, +25°C", 25, 1.0, 1.0),
            ("G1-35", "В воздухе, +35°C, группа 1", 35, 0.91, 1.0),
            ("G1-10", "В воздухе, +10°C, группа 1", 10, 1.08, 1.0),
        ]
        for code, name, temp, k_t, k_g in install_data:
            InstallationCondition.objects.update_or_create(
                group_code=code,
                defaults={
                    "name": name,
                    "ambient_temp_c": temp,
                    "k_temp": k_t,
                    "k_group": k_g,
                },
            )

        # Автоматы
        breaker_items = generate_breakers()
        created_breakers = 0
        for item in breaker_items:
            _, created = CircuitBreaker.objects.update_or_create(
                manufacturer=item["manufacturer"],
                model_name=item["model_name"],
                defaults={
                    "series": item["series"],
                    "breaker_type": item["breaker_type"],
                    "category": item["category"],
                    "in_a": item["in_a"],
                    "icu_ka": item["icu_ka"],
                    "ics_ka": item["ics_ka"],
                    "u_e_v": item["u_e_v"],
                    "u_imp_kv": item["u_imp_kv"],
                    "curve": item["curve"],
                    "poles": item["poles"],
                    "gost_ref": item["gost_ref"],
                },
            )
            if created:
                created_breakers += 1

        self.stdout.write(self.style.SUCCESS(
            f"Каталог загружен: марок {len(brand_map)}, кабелей {Cable.objects.count()} "
            f"(+{created_cables} новых), автоматов {CircuitBreaker.objects.count()} "
            f"(+{created_breakers} новых). "
            f"Удалено устаревших: кабелей {removed_orphans[0]}, марок {removed_brands[0]}"
        ))
