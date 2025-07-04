# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a custom fork of @switchbot/homebridge-switchbot - a Homebridge plugin that integrates SwitchBot devices with Apple HomeKit. The plugin supports both OpenAPI and Bluetooth Low Energy (BLE) connections to communicate with SwitchBot devices.

## Common Development Commands

### Build and Development
- `npm run build` - Clean and compile TypeScript, copy plugin UI files
- `npm run watch` - Build, link plugin, and run with nodemon for development
- `npm run clean` - Remove the dist directory

### Code Quality
- `npm run lint` - Run ESLint on all TypeScript files in src/
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run test` - Run tests with Vitest
- `npm run test:watch` - Run tests in watch mode
- `npm run test-coverage` - Run tests with coverage report

### Documentation
- `npm run docs` - Generate TypeDoc documentation
- `npm run docs:lint` - Check documentation for warnings/errors
- `npm run docs:theme` - Generate docs with default-modern theme

### Publishing
- `npm run prepublishOnly` - Full build pipeline (lint, build, docs)

## Architecture

### Core Structure
- **src/index.ts** - Main plugin entry point that registers the platform
- **src/platform.ts** - Main platform class (large file ~47k tokens)
- **src/settings.ts** - Configuration interfaces and platform constants

### Device Architecture
The plugin follows a hierarchical device structure:

1. **Base Device Classes**
   - `src/device/device.ts` - Base device implementation
   - Individual device files in `src/device/` for each SwitchBot device type

2. **IR Device Classes**
   - `src/irdevice/irdevice.ts` - Base IR device implementation
   - Individual IR device files in `src/irdevice/` for different IR appliances

3. **Supported Device Types**
   - Physical devices: Bot, Curtain, Lock, Humidifier, Meter, Motion/Contact sensors, Plugs, Lights, etc.
   - IR devices: Air conditioners, Fans, Lights, TVs, Cameras, etc.

### Configuration System
- Uses TypeScript interfaces for type-safe configuration
- Supports both individual device configs and device type configs
- Extensive configuration options for each device type including BLE settings, polling rates, and device-specific features

### Connection Types
- **OpenAPI**: Cloud-based connection requiring SwitchBot Hub
- **BLE**: Direct Bluetooth Low Energy connection
- **Dual Support**: Many devices support both connection types

### Key Dependencies
- `node-switchbot` - Core SwitchBot API library
- `homebridge-lib` - Homebridge utilities
- `async-mqtt` - MQTT support for advanced integrations
- `fakegato-history` - Historical data support

## Development Notes

### TypeScript Configuration
- Target: ES2022 with DOM and ES2022 libs
- ES modules with bundler resolution
- Strict mode enabled (except noImplicitAny)
- Source maps and declarations generated

### Testing
- Uses Vitest for testing
- Coverage reporting available with `@vitest/coverage-v8`

### Code Style
- ESLint with @antfu/eslint-config
- Format plugin for consistent formatting

### Plugin UI
- Has a custom Homebridge UI located in `src/homebridge-ui/`
- UI files are copied to dist during build process