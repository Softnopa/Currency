# Meva hisob-kitobi — fruit truck calculator

Enter what each truck brought (fruit, number of boxes, price per box in **yuan**) plus truck expenses, and see the cost in **¥ → $ → so'm**, including the cost of one box with expenses. Exchange rates come from the Central Bank of Uzbekistan (cbu.uz) and refresh every day. The interface is in Uzbek, Latin or Cyrillic.

Stack: Next.js 16, Supabase (login + database), Vercel (hosting + daily cron).

## 1. Supabase setup (once)

1. Create a free project at https://supabase.com.
2. **SQL Editor → New query**: paste the whole of [supabase/schema.sql](supabase/schema.sql) and click **Run**.
3. **Authentication → Sign In / Providers → Email**: turn **off** "Allow new users to sign up", so strangers cannot create accounts.
4. **Authentication → Users → Add user → Create new user**: enter your father's email and a password, and tick **Auto Confirm User**. Add more users the same way if needed. All users see the same trucks.
5. **Project Settings → API Keys**: copy the project URL, the publishable key and the secret key.

## 2. Run on your computer

```bash
cp .env.example .env.local   # then fill in the four values
npm install
npm run dev
```

Open http://localhost:3000 and log in.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. At https://vercel.com → **Add New → Project** → import the repository.
3. Under **Environment Variables**, add the same four values as `.env.local`.
4. Deploy. The cron job in [vercel.json](vercel.json) calls `/api/rates/refresh` every day at 09:00 Tashkent time. Rates are also refreshed when someone opens the site if they are more than 6 hours old.

## Updating an existing database

If you ran `schema.sql` before a feature was added, run the matching file from [supabase/migrations/](supabase/migrations/) in the SQL Editor once:

- [002_archive.sql](supabase/migrations/002_archive.sql) — archive for trucks.
- [003_full_sheet.sql](supabase/migrations/003_full_sheet.sql) — full Excel-sheet layout: truck details, kg per box, two expense sections, goods paid in $.

## Settings page (⚙️ Sozlamalar)

- **Mavzu:** 8 colour themes (including Excel green), light/dark/auto mode, font size, language. Saved per device.
- **Excel:** download every truck as an .xlsx file — a summary sheet plus one sheet per truck in the original layout.
- **Mashinalarni boshqarish:** tick trucks to archive, restore or delete.
- **Hisob:** change password, log out.

## How the numbers are calculated (same as the Excel sheet)

- Product: `boxes × price per box in Urumqi (¥)` = total ¥; `boxes × kg per box` = total kg.
- Expenses come in two sections — up to/at Khorgos, and Khorgos → Tashkent. Each line can be in ¥, $ or so'm and is converted to ¥ with the truck's rate.
- Each section is **split between products by kg** (a product's kg ÷ all kg). If some product has no kg, box count is used instead.
- **1 box at Khorgos** = Urumqi price + Khorgos share ÷ boxes. **1 box in Tashkent** = Khorgos price + Tashkent share ÷ boxes.
- Goods money paid in $ is converted to ¥; the rest is what is paid in ¥.
- Each saved truck keeps its own rate (1 $ = ¥ and 1 $ = so'm); "Bugungi kursni qo'yish" switches it to today's bank rate.
- Every truck can be downloaded as Excel with live formulas, laid out like the original sheet.
