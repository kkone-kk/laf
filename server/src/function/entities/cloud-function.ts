import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ObjectId } from 'mongodb'

export class CloudFunctionSource {
  @ApiProperty()
  code: string

  @ApiProperty()
  compiled: string

  @ApiPropertyOptional()
  uri?: string

  @ApiProperty()
  version: number

  @ApiPropertyOptional()
  hash?: string

  @ApiPropertyOptional()
  lang?: string
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  HEAD = 'HEAD',
}

export enum CloudFunctionState {
  Running = 'Running',
  Stopped = 'Stopped',
}

export class CloudFunction {
  @ApiProperty({ type: String })
  _id?: ObjectId

  @ApiProperty()
  appid: string

  @ApiProperty()
  name: string

  @ApiProperty({ type: CloudFunctionSource })
  source: CloudFunctionSource

  @ApiProperty()
  desc: string

  @ApiProperty({ type: String, isArray: true })
  tags: string[]

  @ApiProperty({ enum: HttpMethod, isArray: true })
  methods: HttpMethod[]

  @ApiProperty({ enum: CloudFunctionState })
  state: CloudFunctionState

  @ApiPropertyOptional()
  params?: any

  @ApiProperty()
  createdAt: Date

  @ApiProperty()
  updatedAt: Date

  @ApiProperty({ type: String })
  createdBy: ObjectId
}
