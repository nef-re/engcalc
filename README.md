# Engineering Portal — инженерные калькуляторы

Портал для инженеров: калькуляторы ЭОМ/ЭС, вентиляция, подбор материалов и оборудования из каталога.

## Стек

- **Backend:** Django 5 + Django Ninja + PostgreSQL + Redis
- **Frontend:** Next.js 14 + TypeScript + Tailwind + ECharts

## Быстрый старт (Docker)

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- API: http://localhost:8000/api/v1/docs
- Admin: http://localhost:8000/admin/

## Локальная разработка (без Docker)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
set DATABASE_URL=sqlite:///db.sqlite3
python manage.py migrate
python manage.py loaddata catalog/fixtures/initial_catalog.json
python manage.py seed_electrical_data
python manage.py createsuperuser
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

## Калькуляторы (ЭОМ/ЭС)

1. Падение напряжения (ΔU)
2. Подбор сечения кабеля
3. Ток короткого замыкания (КЗ)
4. Расчёт нагрузки (заготовка)
5. Подбор автомата (заготовка)

## Структура

```
backend/   — Django API
frontend/  — Next.js UI
```
