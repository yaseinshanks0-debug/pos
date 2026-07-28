# POS Barcode Camera Scanner

A desktop application that replaces a physical USB barcode scanner by using the built-in laptop camera.

## Features
- **Offline First**: Uses local SQLite (when configured) and functions without internet.
- **Keyboard Wedge Mode**: Simulates a physical USB scanner by directly typing scanned barcodes into the active application (e.g. QuickBooks POS) and pressing Enter.
- **Multi-Format Support**: Reads EAN, UPC, Code 128, QR Code, and more.
- **Auto-Updates**: Automatically checks for updates via GitHub releases.

## Development Setup

1. Install dependencies:
   run `npm install`

2. Start the development server:
   run `npm start`

## Building the Windows Installer

This project uses `electron-builder` to generate a production-ready Windows installer (`Setup.exe`) and a standalone executable (`Portable.exe`).

To build the installers for Windows (10/11 x64 and ia32 architectures), run:

   run `npm run build:win`

The output files will be located in the `dist` directory.
