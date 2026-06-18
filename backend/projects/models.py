from django.conf import settings
from django.db import models


class Project(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="projects",
        null=True,
        blank=True,
    )
    name = models.CharField("Название", max_length=256)
    client = models.CharField("Заказчик", max_length=256, blank=True)
    address = models.CharField("Адрес объекта", max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Проект"
        verbose_name_plural = "Проекты"
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return self.name


class ProjectSection(models.Model):
    SECTION_CHOICES = [
        ("EOM", "ЭОМ"),
        ("ES", "ЭС"),
        ("OV", "ОВ"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="sections")
    section_type = models.CharField("Раздел", max_length=8, choices=SECTION_CHOICES)
    notes = models.TextField("Примечания", blank=True)

    class Meta:
        verbose_name = "Раздел проекта"
        verbose_name_plural = "Разделы проекта"
        unique_together = [("project", "section_type")]

    def __str__(self) -> str:
        return f"{self.project.name} — {self.get_section_type_display()}"
