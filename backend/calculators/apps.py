from django.apps import AppConfig


class CalculatorsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "calculators"
    verbose_name = "Калькуляторы"

    def ready(self) -> None:
        import calculators.registry  # noqa: F401
