from django.db import models


class CableBrand(models.Model):
    name = models.CharField("Марка", max_length=64, unique=True)
    description = models.TextField("Описание", blank=True)

    class Meta:
        verbose_name = "Марка кабеля"
        verbose_name_plural = "Марки кабелей"

    def __str__(self) -> str:
        return self.name


class InstallationCondition(models.Model):
    """Условия прокладки кабеля (группа, температура)."""

    name = models.CharField("Название", max_length=128)
    group_code = models.CharField("Группа прокладки", max_length=16)
    ambient_temp_c = models.FloatField("Температура, °C", default=25)
    k_temp = models.FloatField("k температуры", default=1.0)
    k_group = models.FloatField("k группы", default=1.0)

    class Meta:
        verbose_name = "Условие прокладки"
        verbose_name_plural = "Условия прокладки"

    def __str__(self) -> str:
        return self.name


class Cable(models.Model):
    MATERIAL_CHOICES = [
        ("Cu", "Медь"),
        ("Al", "Алюминий"),
    ]

    brand = models.ForeignKey(CableBrand, on_delete=models.CASCADE, related_name="cables")
    name = models.CharField("Наименование", max_length=128)
    section_mm2 = models.FloatField("Сечение, мм²")
    cores = models.PositiveSmallIntegerField("Жил", default=3)
    material = models.CharField("Материал", max_length=8, choices=MATERIAL_CHOICES, default="Cu")
    u_max_v = models.PositiveIntegerField("Класс напряжения, В", default=1000)
    r_mohm_per_m = models.FloatField("R, мОм/м (рабочая)")
    r_20_mohm_per_m = models.FloatField("R при 20°C, мОм/м", null=True, blank=True)
    temp_coeff = models.FloatField("Темп. коэф. α", default=0.004)
    x_mohm_per_m = models.FloatField("X, мОм/м")
    i_long_a = models.FloatField("Iд. long, А")
    outer_diameter_mm = models.FloatField("Наружный диаметр, мм", default=10.0)
    min_bend_radius_mm = models.FloatField("Мин. радиус изгиба, мм", null=True, blank=True)
    n_core_section_mm2 = models.FloatField("Сечение N, мм²", null=True, blank=True)
    pe_core_section_mm2 = models.FloatField("Сечение PE, мм²", null=True, blank=True)
    mass_kg_per_m = models.FloatField("Масса, кг/м", null=True, blank=True)
    gost_ref = models.CharField("ГОСТ", max_length=64, blank=True, default="ГОСТ 31996-2012")

    class Meta:
        verbose_name = "Кабель"
        verbose_name_plural = "Кабели"
        ordering = ["section_mm2"]

    def __str__(self) -> str:
        return self.name


class CircuitBreaker(models.Model):
    CURVE_CHOICES = [("B", "B"), ("C", "C"), ("D", "D")]
    TYPE_CHOICES = [
        ("MCB", "Автомат модульный"),
        ("MCCB", "Автомат в литом корпусе"),
        ("ACB", "Воздушный автомат"),
    ]

    manufacturer = models.CharField("Производитель", max_length=64)
    model_name = models.CharField("Модель", max_length=128)
    breaker_type = models.CharField("Тип", max_length=8, choices=TYPE_CHOICES, default="MCB")
    in_a = models.FloatField("In, А")
    icu_ka = models.FloatField("Icu, кА")
    ics_ka = models.FloatField("Ics, кА", null=True, blank=True)
    u_e_v = models.PositiveIntegerField("Ue, В", default=400)
    u_imp_kv = models.FloatField("Uimp, кВ", default=4.0)
    curve = models.CharField("Кривая", max_length=1, choices=CURVE_CHOICES, default="C")
    poles = models.PositiveSmallIntegerField("Полюса", default=1)
    has_rcd = models.BooleanField("С дифзащитой", default=False)
    rcd_type = models.CharField("Тип УЗО", max_length=8, blank=True)
    rcd_in_ma = models.PositiveSmallIntegerField("IΔn, мА", null=True, blank=True)
    gost_ref = models.CharField("ГОСТ", max_length=64, blank=True, default="ГОСТ Р 50345-2010")

    class Meta:
        verbose_name = "Автоматический выключатель"
        verbose_name_plural = "Автоматические выключатели"
        ordering = ["in_a"]

    def __str__(self) -> str:
        return f"{self.manufacturer} {self.model_name} {self.in_a}A"


class Transformer(models.Model):
    name = models.CharField("Наименование", max_length=128)
    s_kva = models.FloatField("S, кВА")
    u_primary_kv = models.FloatField("U1, кВ")
    u_secondary_v = models.FloatField("U2, В", default=400)
    uk_percent = models.FloatField("Uk, %")

    class Meta:
        verbose_name = "Трансформатор"
        verbose_name_plural = "Трансформаторы"

    def __str__(self) -> str:
        return self.name


class DuctType(models.Model):
    SHAPE_CHOICES = [("round", "Круглый"), ("rect", "Прямоугольный")]

    name = models.CharField("Тип", max_length=64)
    shape = models.CharField("Форма", max_length=8, choices=SHAPE_CHOICES)
    roughness_mm = models.FloatField("Шероховатость, мм", default=0.15)

    class Meta:
        verbose_name = "Тип воздуховода"
        verbose_name_plural = "Типы воздуховодов"

    def __str__(self) -> str:
        return self.name


class Fan(models.Model):
    manufacturer = models.CharField("Производитель", max_length=64)
    model_name = models.CharField("Модель", max_length=128)
    q_max_m3h = models.FloatField("Q max, м³/ч")
    p_max_pa = models.FloatField("P max, Па")
    efficiency = models.FloatField("КПД, %", default=70)
    curve_points = models.JSONField("Кривая L-P", default=list, blank=True)

    class Meta:
        verbose_name = "Вентилятор"
        verbose_name_plural = "Вентиляторы"

    def __str__(self) -> str:
        return f"{self.manufacturer} {self.model_name}"
