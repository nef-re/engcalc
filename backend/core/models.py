from django.db import models


class StandardReference(models.Model):
    """Ссылка на нормативный документ (ПУЭ, ГОСТ, СП)."""

    code = models.CharField("Код", max_length=64, unique=True)
    title = models.CharField("Название", max_length=256)
    clause = models.CharField("Пункт", max_length=64, blank=True)
    description = models.TextField("Описание", blank=True)

    class Meta:
        verbose_name = "Нормативный документ"
        verbose_name_plural = "Нормативные документы"

    def __str__(self) -> str:
        return f"{self.code} {self.clause}".strip()
