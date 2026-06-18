from django.apps import AppConfig


class VentilationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "ventilation"
    verbose_name = "Вентиляция"

    def ready(self) -> None:
        from calculators.registry import register
        from ventilation.calculators import (
            AirflowCalculator,
            DuctResistanceCalculator,
            FanSelectionCalculator,
        )

        for cls in [AirflowCalculator, DuctResistanceCalculator, FanSelectionCalculator]:
            register(cls())
