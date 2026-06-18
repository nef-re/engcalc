from django.conf import settings
from django.db import models


class CalculatorDefinition(models.Model):
    DISCIPLINE_CHOICES = [
        ("electrical", "Электрика"),
        ("ventilation", "Вентиляция"),
    ]

    slug = models.SlugField("Slug", max_length=64, unique=True)
    discipline = models.CharField("Раздел", max_length=32, choices=DISCIPLINE_CHOICES)
    name = models.CharField("Название", max_length=128)
    description = models.TextField("Описание", blank=True)
    order = models.PositiveSmallIntegerField("Порядок", default=0)
    standard_ref = models.CharField("Норматив", max_length=128, blank=True)
    standards = models.ManyToManyField(
        "core.StandardReference",
        blank=True,
        related_name="calculators",
        verbose_name="Нормативные документы",
    )
    is_active = models.BooleanField("Активен", default=True)

    class Meta:
        verbose_name = "Калькулятор"
        verbose_name_plural = "Калькуляторы"
        ordering = ["discipline", "order"]

    def __str__(self) -> str:
        return self.name


class CalculationRun(models.Model):
    calculator = models.ForeignKey(
        CalculatorDefinition,
        on_delete=models.CASCADE,
        related_name="runs",
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="calculations",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    input_data = models.JSONField("Входные данные")
    result_data = models.JSONField("Результат")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Расчёт"
        verbose_name_plural = "Расчёты"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.calculator.slug} @ {self.created_at:%Y-%m-%d %H:%M}"
