import { Request, Response } from 'express'
import { Application } from 'src/application/entities/application'

export interface IRequest extends Request {
  application?: Application
  [key: string]: any
}

export interface IResponse extends Response {
  [key: string]: any
}
