/* Copyright(C) 2021-2024, donavanbecker (https://github.com/donavanbecker). All rights reserved.
 *
 * light.ts: @switchbot/homebridge-switchbot.
 */
import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge'
import type { bodyChange, irdevice } from 'node-switchbot'

import type { SwitchBotPlatform } from '../platform.js'
import type { BrightnessCommand, irDevicesConfig, irLightConfig } from '../settings.js'

import { irdeviceBase } from './irdevice.js'

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class Light extends irdeviceBase {
  // Services
  private LightBulb?: {
    Name: CharacteristicValue
    Service: Service
    On: CharacteristicValue
    Brightness?: CharacteristicValue
  }

  // Brightness command mapping
  private brightnessCommands: Map<number, BrightnessCommand> = new Map()

  private ProgrammableSwitchOn?: {
    Name: CharacteristicValue
    Service: Service
    ProgrammableSwitchEvent: CharacteristicValue
    ProgrammableSwitchOutputState: CharacteristicValue
  }

  private ProgrammableSwitchOff?: {
    Name: CharacteristicValue
    Service: Service
    ProgrammableSwitchEvent: CharacteristicValue
    ProgrammableSwitchOutputState: CharacteristicValue
  }

  constructor(
    readonly platform: SwitchBotPlatform,
    accessory: PlatformAccessory,
    device: irdevice & irDevicesConfig,
  ) {
    super(platform, accessory, device)
    // Set category
    accessory.category = this.hap.Categories.LIGHTBULB

    if (!(device as irLightConfig).stateless) {
      // Check if brightness support is configured before creating service
      const willSupportBrightness = this.hasBrightnessConfig()

      // Initialize LightBulb Service
      accessory.context.LightBulb = accessory.context.LightBulb ?? {}
      this.LightBulb = {
        Name: accessory.displayName,
        Service: accessory.getService(this.hap.Service.Lightbulb) ?? accessory.addService(this.hap.Service.Lightbulb) as Service,
        On: accessory.context.On || false,
      }
      accessory.context.LightBulb = this.LightBulb as object

      // Set basic characteristics
      this.LightBulb.Service.setCharacteristic(this.hap.Characteristic.Name, this.LightBulb.Name)

      // Setup On characteristic
      this.LightBulb.Service.getCharacteristic(this.hap.Characteristic.On).onGet(() => {
        return this.LightBulb!.On
      }).onSet(this.OnSet.bind(this))

      // Initialize brightness support if enabled
      if (willSupportBrightness) {
        this.initializeBrightnessCommands()
        if (this.supportsBrightness()) {
          this.setupBrightnessCharacteristic()
          this.debugLog('Brightness control enabled for IR Light device')
        } else {
          this.warnLog('Invalid brightness configuration, brightness control disabled')
        }
      }
    } else {
      // Initialize ProgrammableSwitchOn Service
      accessory.context.ProgrammableSwitchOn = accessory.context.ProgrammableSwitchOn ?? {}
      this.ProgrammableSwitchOn = {
        Name: `${accessory.displayName} On`,
        Service: accessory.getService(this.hap.Service.StatefulProgrammableSwitch) ?? accessory.addService(this.hap.Service.StatefulProgrammableSwitch) as Service,
        ProgrammableSwitchEvent: accessory.context.ProgrammableSwitchEvent ?? this.hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
        ProgrammableSwitchOutputState: accessory.context.ProgrammableSwitchOutputState ?? 0,
      }
      accessory.context.ProgrammableSwitchOn = this.ProgrammableSwitchOn as object

      // Initialize ProgrammableSwitchOn Characteristics
      this.ProgrammableSwitchOn?.Service.setCharacteristic(this.hap.Characteristic.Name, this.ProgrammableSwitchOn.Name).getCharacteristic(this.hap.Characteristic.ProgrammableSwitchEvent).setProps({
        validValueRanges: [0, 0],
        minValue: 0,
        maxValue: 0,
        validValues: [0],
      }).onGet(() => {
        return this.ProgrammableSwitchOn!.ProgrammableSwitchEvent
      })

      this.ProgrammableSwitchOn?.Service.getCharacteristic(this.hap.Characteristic.ProgrammableSwitchOutputState).onGet(() => {
        return this.ProgrammableSwitchOn!.ProgrammableSwitchOutputState
      }).onSet(this.ProgrammableSwitchOutputStateSetOn.bind(this))

      // Initialize ProgrammableSwitchOff Service
      accessory.context.ProgrammableSwitchOff = accessory.context.ProgrammableSwitchOff ?? {}
      this.ProgrammableSwitchOff = {
        Name: `${accessory.displayName} Off`,
        Service: accessory.getService(this.hap.Service.StatefulProgrammableSwitch) ?? accessory.addService(this.hap.Service.StatefulProgrammableSwitch) as Service,
        ProgrammableSwitchEvent: accessory.context.ProgrammableSwitchEvent ?? this.hap.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
        ProgrammableSwitchOutputState: accessory.context.ProgrammableSwitchOutputState ?? 0,
      }
      accessory.context.ProgrammableSwitchOff = this.ProgrammableSwitchOff as object

      // Initialize ProgrammableSwitchOff Characteristics
      this.ProgrammableSwitchOff?.Service.setCharacteristic(this.hap.Characteristic.Name, this.ProgrammableSwitchOff.Name).getCharacteristic(this.hap.Characteristic.ProgrammableSwitchEvent).setProps({
        validValueRanges: [0, 0],
        minValue: 0,
        maxValue: 0,
        validValues: [0],
      }).onGet(() => {
        return this.ProgrammableSwitchOff!.ProgrammableSwitchEvent
      })

      this.ProgrammableSwitchOff?.Service.getCharacteristic(this.hap.Characteristic.ProgrammableSwitchOutputState).onGet(() => {
        return this.ProgrammableSwitchOff!.ProgrammableSwitchOutputState
      }).onSet(this.ProgrammableSwitchOutputStateSetOff.bind(this))
    }
  }

  async OnSet(value: CharacteristicValue): Promise<void> {
    this.debugLog(`On: ${value}`)

    this.LightBulb!.On = value
    if (this.LightBulb?.On) {
      // When turning on from 0% brightness, restore to 100%
      if (this.supportsBrightness() && (this.LightBulb.Brightness ?? 0) === 0) {
        this.LightBulb.Brightness = 100
      }
      await this.pushLightOnChanges(true)
    } else {
      // When turning off, set brightness to 0
      if (this.supportsBrightness() && this.LightBulb) {
        this.LightBulb.Brightness = 0
      }
      await this.pushLightOffChanges(false)
    }
    /**
     * pushLightOnChanges and pushLightOffChanges above assume they are measuring the state of the accessory BEFORE
     * they are updated, so we are only updating the accessory state after calling the above.
     */
  }

  async ProgrammableSwitchOutputStateSetOn(value: CharacteristicValue): Promise<void> {
    this.debugLog(`On: ${value}`)

    this.ProgrammableSwitchOn!.ProgrammableSwitchOutputState = value
    if (this.ProgrammableSwitchOn?.ProgrammableSwitchOutputState === 1) {
      const On = true
      await this.pushLightOnChanges(On)
    }
    /**
     * pushLightOnChanges and pushLightOffChanges above assume they are measuring the state of the accessory BEFORE
     * they are updated, so we are only updating the accessory state after calling the above.
     */
  }

  async ProgrammableSwitchOutputStateSetOff(value: CharacteristicValue): Promise<void> {
    this.debugLog(`On: ${value}`)

    this.ProgrammableSwitchOff!.ProgrammableSwitchOutputState = value
    if (this.ProgrammableSwitchOff?.ProgrammableSwitchOutputState === 1) {
      const On = false
      await this.pushLightOffChanges(On)
    }
    /**
     * pushLightOnChanges and pushLightOffChanges above assume they are measuring the state of the accessory BEFORE
     * they are updated, so we are only updating the accessory state after calling the above.
     */
  }

  /**
   * Pushes the requested changes to the SwitchBot API
   * deviceType    commandType     Command          command parameter           Description
   * Light -       "command"       "turnOff"         "default"          =        set to OFF state
   * Light -       "command"       "turnOn"          "default"          =        set to ON state
   * Light -       "command"       "volumeAdd"       "default"          =        volume up
   * Light -       "command"       "volumeSub"       "default"          =        volume down
   * Light -       "command"       "channelAdd"      "default"          =        next channel
   * Light -       "command"       "channelSub"      "default"          =        previous channel
   */
  async pushLightOnChanges(On: boolean): Promise<void> {
    this.debugLog(`pushLightOnChanges On: ${On}, disablePushOn: ${this.deviceDisablePushOn}`)
    if (On === true && this.deviceDisablePushOn === false) {
      const commandType: string = await this.commandType()
      const command: string = await this.commandOn()
      const bodyChange: bodyChange = {
        command,
        parameter: 'default',
        commandType,
      }
      await this.pushChanges(bodyChange, On)
    }
  }

  async pushLightOffChanges(On: boolean): Promise<void> {
    this.debugLog(`pushLightOffChanges On: ${On}, disablePushOff: ${this.deviceDisablePushOff}`)
    if (On === false && this.deviceDisablePushOff === false) {
      const commandType: string = await this.commandType()
      const command: string = await this.commandOff()
      const bodyChange: bodyChange = {
        command,
        parameter: 'default',
        commandType,
      }
      await this.pushChanges(bodyChange, On)
    }
  }

  async pushChanges(bodyChange: any, On: boolean): Promise<void> {
    this.debugLog('pushChanges')
    if (this.device.connectionType === 'OpenAPI') {
      this.infoLog(`Sending request to SwitchBot API, body: ${JSON.stringify(bodyChange)}`)
      try {
        const response = await this.pushChangeRequest(bodyChange)
        const deviceStatus: any = response.body
        await this.pushStatusCodes(deviceStatus)
        if (await this.successfulStatusCodes(deviceStatus)) {
          await this.successfulPushChange(deviceStatus, bodyChange)
          this.accessory.context.On = On
          await this.updateHomeKitCharacteristics()
        } else {
          await this.statusCode(deviceStatus.statusCode)
        }
      } catch (e: any) {
        await this.apiError(e)
        await this.pushChangeError(e)
      }
    } else {
      this.warnLog(`Connection Type: ${this.device.connectionType}, commands will not be sent to OpenAPI`)
    }
  }

  async updateHomeKitCharacteristics(): Promise<void> {
    this.debugLog('updateHomeKitCharacteristics')
    if (!(this.device as irLightConfig).stateless && this.LightBulb?.Service) {
      // On
      await this.updateCharacteristic(this.LightBulb.Service, this.hap.Characteristic.On, this.LightBulb.On, 'On')
      // Brightness
      if (this.supportsBrightness() && this.LightBulb.Brightness !== undefined) {
        await this.updateCharacteristic(this.LightBulb.Service, this.hap.Characteristic.Brightness, this.LightBulb.Brightness, 'Brightness')
      }
    } else {
      if (this.ProgrammableSwitchOn?.Service) {
        // On Stateful Programmable Switch
        await this.updateCharacteristic(this.ProgrammableSwitchOn.Service, this.hap.Characteristic.ProgrammableSwitchOutputState, this.ProgrammableSwitchOn.ProgrammableSwitchOutputState, 'ProgrammableSwitchOutputState')
      }
      if (this.ProgrammableSwitchOff?.Service) {
        // Off Stateful Programmable Switch
        await this.updateCharacteristic(this.ProgrammableSwitchOff.Service, this.hap.Characteristic.ProgrammableSwitchOutputState, this.ProgrammableSwitchOff.ProgrammableSwitchOutputState, 'ProgrammableSwitchOutputState')
      }
    }
  }

  async apiError(e: any): Promise<void> {
    if (!(this.device as irLightConfig).stateless) {
      this.LightBulb?.Service.updateCharacteristic(this.hap.Characteristic.On, e)
      if (this.supportsBrightness()) {
        this.LightBulb?.Service.updateCharacteristic(this.hap.Characteristic.Brightness, e)
      }
    } else {
      this.ProgrammableSwitchOn?.Service.updateCharacteristic(this.hap.Characteristic.ProgrammableSwitchEvent, e)
      this.ProgrammableSwitchOn?.Service.updateCharacteristic(this.hap.Characteristic.ProgrammableSwitchOutputState, e)
      this.ProgrammableSwitchOff?.Service.updateCharacteristic(this.hap.Characteristic.ProgrammableSwitchEvent, e)
      this.ProgrammableSwitchOff?.Service.updateCharacteristic(this.hap.Characteristic.ProgrammableSwitchOutputState, e)
    }
  }

  private hasBrightnessConfig(): boolean {
    const lightConfig = this.device as irLightConfig
    return !lightConfig.stateless
      && lightConfig.supportsBrightness === true
      && Array.isArray(lightConfig.brightnessCommands)
      && lightConfig.brightnessCommands.length > 0
  }

  private supportsBrightness(): boolean {
    return this.hasBrightnessConfig() && this.brightnessCommands.size > 0
  }

  private initializeBrightnessCommands(): void {
    const lightConfig = this.device as irLightConfig
    if (!lightConfig.brightnessCommands) {
      this.warnLog('Brightness support enabled but no brightness commands configured')
      return
    }

    this.brightnessCommands.clear()
    const duplicateLevels: number[] = []
    const invalidCommands: string[] = []

    for (const cmd of lightConfig.brightnessCommands) {
      // 範囲チェック
      if (cmd.level < 0 || cmd.level > 100) {
        invalidCommands.push(`Level ${cmd.level} is out of range (0-100)`)
        continue
      }

      // コマンド名チェック
      if (!cmd.command || cmd.command.trim() === '') {
        invalidCommands.push(`Empty command for level ${cmd.level}`)
        continue
      }

      // 重複チェック
      if (this.brightnessCommands.has(cmd.level)) {
        duplicateLevels.push(cmd.level)
        continue
      }

      this.brightnessCommands.set(cmd.level, cmd)
    }

    // 警告出力
    if (duplicateLevels.length > 0) {
      this.warnLog(`Duplicate brightness levels found and ignored: ${duplicateLevels.join(', ')}`)
    }
    if (invalidCommands.length > 0) {
      this.warnLog(`Invalid brightness commands: ${invalidCommands.join('; ')}`)
    }

    if (this.brightnessCommands.size === 0) {
      this.errorLog('No valid brightness commands configured, brightness control will be disabled')
      return
    }

    this.debugLog(`Initialized ${this.brightnessCommands.size} brightness commands: [${Array.from(this.brightnessCommands.keys()).sort((a, b) => a - b).join(', ')}]`)
  }

  private setupBrightnessCharacteristic(): void {
    if (!this.LightBulb?.Service) {
      return
    }

    const lightConfig = this.device as irLightConfig
    this.LightBulb.Brightness = this.accessory.context.Brightness ?? 100

    // Ensure the brightness characteristic exists on the service
    if (!this.LightBulb.Service.testCharacteristic(this.hap.Characteristic.Brightness)) {
      this.LightBulb.Service.addCharacteristic(this.hap.Characteristic.Brightness)
      this.debugLog('Added Brightness characteristic to Lightbulb service')
    }

    this.LightBulb.Service
      .getCharacteristic(this.hap.Characteristic.Brightness)
      .setProps({
        minValue: lightConfig.set_min ?? 0,
        maxValue: lightConfig.set_max ?? 100,
        minStep: lightConfig.set_minStep ?? 1,
      })
      .onGet(() => this.LightBulb!.Brightness ?? 100)
      .onSet(this.BrightnessSet.bind(this))

    this.debugLog(`Brightness characteristic setup complete. Range: ${lightConfig.set_min ?? 0}-${lightConfig.set_max ?? 100}, Step: ${lightConfig.set_minStep ?? 1}`)
  }

  private findClosestBrightnessLevel(targetLevel: number): BrightnessCommand | null {
    if (this.brightnessCommands.size === 0) {
      return null
    }

    const levels = Array.from(this.brightnessCommands.keys()).sort((a, b) => a - b)

    // 完全一致
    if (this.brightnessCommands.has(targetLevel)) {
      return this.brightnessCommands.get(targetLevel)!
    }

    // 最近傍検索
    let closest = levels[0]
    let minDistance = Math.abs(targetLevel - closest)

    for (const level of levels) {
      const distance = Math.abs(targetLevel - level)
      if (distance < minDistance) {
        minDistance = distance
        closest = level
      }
    }

    return this.brightnessCommands.get(closest)!
  }

  async BrightnessSet(value: CharacteristicValue): Promise<void> {
    this.debugLog(`Brightness: ${value}`)

    const brightness = Number(value)
    this.LightBulb!.Brightness = brightness

    // 明るさが0の場合は消灯
    if (brightness === 0) {
      this.LightBulb!.On = false
      await this.pushLightOffChanges(false)
    } else {
      // 明るさが1以上の場合は点灯して明るさ調整
      if (!this.LightBulb!.On) {
        this.LightBulb!.On = true
      }
      await this.pushBrightnessChanges(brightness)
    }
  }

  async pushBrightnessChanges(brightness: number): Promise<void> {
    this.debugLog(`pushBrightnessChanges brightness: ${brightness}, disablePushDetail: ${this.deviceDisablePushDetail}`)

    if (this.deviceDisablePushDetail) {
      return
    }

    const brightnessCmnd = this.findClosestBrightnessLevel(brightness)
    if (!brightnessCmnd) {
      this.errorLog(`No brightness command found for level: ${brightness}`)
      return
    }

    const commandType: string = await this.commandType()
    const bodyChange: bodyChange = {
      command: brightnessCmnd.command,
      parameter: brightnessCmnd.parameter ?? 'default',
      commandType,
    }

    this.debugLog(`Sending brightness command: ${brightnessCmnd.command} for level ${brightnessCmnd.level} (target: ${brightness})`)
    await this.pushChanges(bodyChange, true)
  }
}
