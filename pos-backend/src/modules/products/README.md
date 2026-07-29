# Product Management Module

## Overview
This module handles all product-related operations for the POS system, adhering to Clean Architecture and Domain-Driven Design (DDD) principles. It manages Products, Categories, Brands, Barcodes, and multiple Price Tiers.

## Architecture Highlights
- **Domain:** Defines core entities (`Product`, `Category`, `Brand`) and value objects (`Barcode`, `Money`).
- **Application:** Implements CQRS with Commands (e.g., `CreateProductCommand`) and Queries (e.g., `GetProductQuery`).
- **Infrastructure:** Utilizes Drizzle ORM to interact with the PostgreSQL database.
- **Interfaces:** Exposes RESTful endpoints via NestJS controllers, strictly validated with DTOs.

## Data Model (Infrastructure)
The database schema handles a complex product structure:
- `products`: Base product details and attributes.
- `categories` and `brands`: Metadata references.
- `product_barcodes`: One-to-many relationship supporting multiple barcodes (e.g., UPC, EAN).
- `product_prices`: One-to-many relationship supporting pricing by tier (`RETAIL`, `WHOLESALE`) and by specific `storeId`.

## Requirements Fulfilled
- Products, Categories, Brands.
- Multiple Barcodes per product.
- Multiple Prices (Tiers and Stores) per product.
- Units of Measure.
- Clean Architecture, DDD, CQRS, SOLID.

## Extensibility
Future additions (like Inventory linkages) should interact with the Application layer via domain events or inter-module CQRS orchestration, maintaining strict boundaries.
