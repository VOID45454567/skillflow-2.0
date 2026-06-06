import { ConfigModuleOptions } from '@nestjs/config'
import { configuration } from '../app.config'

export const configModuleOptions: ConfigModuleOptions = {
    isGlobal: true,
    envFilePath: '.env',
    load: [configuration],
}