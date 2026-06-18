from django.contrib import admin

from calculators.models import CalculationRun, CalculatorDefinition


@admin.register(CalculatorDefinition)
class CalculatorDefinitionAdmin(admin.ModelAdmin):
    list_display = ("slug", "name", "discipline", "order", "is_active")
    list_filter = ("discipline", "is_active")


@admin.register(CalculationRun)
class CalculationRunAdmin(admin.ModelAdmin):
    list_display = ("calculator", "project", "user", "created_at")
    list_filter = ("calculator",)
