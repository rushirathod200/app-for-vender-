# Building Cafe - Food Ordering System (Laravel 12)

A complete end-to-end multi-building food ordering system built with Laravel (MVC), MySQL, Blade, and Tailwind CSS.

## Features

### Roles
- Admin
- Vendor
- Customer

### Panels
- Customer Website (`/`)
- Admin Panel (`/admin`)
- Vendor Panel (`/vendor`)

### Customer Flow
- Mobile number + OTP login
- Select Building -> Wing -> Floor
- Select office number from available offices for selected floor
- Browse vendor menu for selected building
- Add items to cart and manage quantity
- Checkout with COD (Cash on Delivery)
- View order history and details

### Vendor Flow
- View assigned buildings
- Manage building menu using predefined products from Admin Product Master
- Upload item photos to `storage/app/public/menu`
- Mark products `In Stock` / `Out Of Stock` (active/inactive for customers)
- View incoming orders
- Update order status with allowed transitions:
  - `placed -> accepted -> preparing -> out_for_delivery -> delivered`
  - Vendor can cancel before delivery

### Admin Flow
- Manage buildings with multi-wing setup (`Building -> Wings -> Floors -> Offices`)
- Manage Product Master (`name + description + category + default image + status`)
- Manage users (admin/vendor/customer)
- Assign vendors to buildings
- View/filter all orders
- Update order status anytime

## Tech Stack
- Laravel 12 (MVC)
- MySQL
- Blade + Tailwind CSS (via Vite)
- Session-based auth with OTP verification
- FormRequest validation
- Service classes (`OtpService`, `CartService`, `OrderService`)
- Service classes (`OtpService`, `CartService`, `OrderService`, `BuildingService`, `LocationService`)
- Middleware-based role authorization

## Business Rules Implemented
- Customer must select location before viewing menu
- Menu shown only for vendor assigned to selected building
- Vendor can only manage own assigned building data
- Delivery fee:
  - If subtotal `< 50` => `20`
  - If subtotal `>= 50` => `0`
- Unavailable items cannot be ordered
- Totals are persisted at order creation
- Admin can deactivate users/buildings

## Database Tables
- `users`
- `otp_codes`
- `buildings`
- `wings`
- `floors`
- `offices`
- `vendor_buildings`
- `predefined_products`
- `menu_items`
- `carts`
- `cart_items`
- `orders`
- `order_items`

## Setup

1. Install dependencies:
```bash
composer install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Configure `.env` for MySQL:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=building_cafe
DB_USERNAME=root
DB_PASSWORD=
```

4. Generate app key:
```bash
php artisan key:generate
```

5. Run migrations and seeders:
```bash
php artisan migrate --seed
```

6. Create storage symlink for uploaded images:
```bash
php artisan storage:link
```

7. Install frontend dependencies and run Vite:
```bash
npm install
npm run dev
```

8. Start Laravel server:
```bash
php artisan serve
```

## OTP (Dev Mode)
- OTP is generated and stored in `otp_codes`
- OTP is logged in Laravel logs
- In local environment, OTP is also shown on login screen
- Configurable from `config/otp.php`

## Demo Data (Seeded)

### Admin
- Mobile: `9999999999`

### Demo Vendors
- `8888888888` (Demo Vendor)
- `8888888899` (Brew Point Vendor)
- `8888888877` (Snack Hub Vendor)

### Demo Customer
- Mobile: `7777777777`

### Demo Building Setup
- Buildings:
  - `RK Iconic`
  - `Tech Park A`
  - `Innovation Hub`
  - `Corporate Tower`
  - `Startup Center`
- Multiple wings and floors seeded per building (examples: `A Wing`, `B Wing`, `North Wing`, `Tower 1`)
- Office numbers seeded per floor (examples: `A-101`, `B-205`, `N-201`, `T1-304`, `BE-204`)
- Vendors pre-assigned to demo buildings with seeded menu items
- 15+ predefined products seeded with relevant default product images

## Demo Flow

1. Login as Admin (`9999999999`) with OTP
2. Create/update buildings using wing configuration:
   - Enter building name and address
   - Add one or more wings
   - Set total floors for each wing (floors are auto-generated)
   - Set `offices per floor` to auto-generate office numbers (e.g. `101-110`, `201-210`)
3. Review/edit generated floors and offices as needed
4. Create vendor user (or use seeded vendor)
5. Assign vendor to building via `Admin -> Vendor Assignment`
6. Login as Vendor (`8888888888`) and add/edit menu
7. Login as Customer (`7777777777`)
8. Select location, add items to cart, checkout, place order
9. Vendor updates order status, Admin monitors all orders

## Important Routes

### Customer
- `GET /`
- `GET /login`
- `GET /select-location`
- `GET /menu`
- `GET /cart`
- `GET /checkout`
- `GET /orders`

### Admin
- `GET /admin/dashboard`
- `GET /admin/buildings`
- `GET /admin/products`
- `GET /admin/buildings/{building}/floors`
- `GET /admin/floors/{floor}/offices`
- `GET /admin/users`
- `GET /admin/assign-vendors`
- `GET /admin/orders`

### Vendor
- `GET /vendor/dashboard`
- `GET /vendor/buildings`
- `GET /vendor/menu`
- `GET /vendor/orders`

## Notes
- Payment method is COD only (`orders.payment_method = cod`)
- Image uploads use Laravel public disk
- CSRF, validation, and role checks are enabled
- Pagination is used across list screens
