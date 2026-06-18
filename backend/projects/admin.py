from django.contrib import admin

from projects.models import Project, ProjectSection


class ProjectSectionInline(admin.TabularInline):
    model = ProjectSection
    extra = 1


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "client", "owner", "updated_at")
    search_fields = ("name", "client")
    inlines = [ProjectSectionInline]


@admin.register(ProjectSection)
class ProjectSectionAdmin(admin.ModelAdmin):
    list_display = ("project", "section_type")
