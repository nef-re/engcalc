from django.conf import settings
from django.db import models


class ElectricalSystem(models.Model):
    """Схема распределения: ВРУ → РЩ → ГЩ → нагрузки."""

    EARTHING_CHOICES = [
        ("TN-C-S", "TN-C-S"),
        ("TN-S", "TN-S"),
        ("TN-C", "TN-C"),
        ("TT", "TT"),
    ]

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="electrical_systems",
        null=True,
        blank=True,
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="electrical_systems",
        null=True,
        blank=True,
    )
    name = models.CharField("Название", max_length=256)
    description = models.TextField("Описание", blank=True)
    u_nom_v = models.FloatField("Uном, В", default=400)
    z_source_mohm = models.FloatField("Z источника, мОм", default=10.0)
    earthing_system = models.CharField(
        "Система заземления",
        max_length=8,
        choices=EARTHING_CHOICES,
        default="TN-C-S",
    )
    graph_data = models.JSONField("Схема (nodes/edges)", default=dict, blank=True)
    last_result = models.JSONField("Последний расчёт", default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Электрическая система"
        verbose_name_plural = "Электрические системы"
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return self.name
