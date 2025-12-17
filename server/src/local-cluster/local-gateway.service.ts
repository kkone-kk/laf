import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { createProxyMiddleware } from 'http-proxy-middleware'
import * as express from 'express'
import * as http from 'http'
import { ProcessManagerService } from './process-manager.service'

@Injectable()
export class LocalGatewayService implements OnModuleInit {
    private readonly logger = new Logger(LocalGatewayService.name)
    private app: express.Express
    private server: http.Server
    private port = parseInt(process.env.LOCAL_GATEWAY_PORT || '8082') // configurable port

    constructor(private readonly processManager: ProcessManagerService) { }

    onModuleInit() {
        this.startProxyServer()
    }

    startProxyServer() {
        this.app = express()

        // Proxy for shared runtime - all requests go to the shared runtime
        this.app.use((req, res, next) => {
            const host = req.hostname
            const path = req.path

            this.logger.log(`Incoming request: host=${host}, path=${path}`)

            // Extract appid from host (appid.127.0.0.1.nip.io or appid.localhost)
            let appid: string | null = null
            if (host) {
                appid = host.split('.')[0]
            }

            // Get shared runtime port
            const sharedRuntimePort = this.processManager.getSharedRuntimePort()

            if (this.processManager.isSharedRuntimeRunning()) {
                this.logger.log(`Proxying request to shared runtime on localhost:${sharedRuntimePort}`)

                // Add appid to headers so the shared runtime knows which app this is for
                const proxyMiddleware = createProxyMiddleware({
                    target: `http://localhost:${sharedRuntimePort}`,
                    changeOrigin: true,
                    ws: true,
                    onProxyReq: (proxyReq: any, req: any, res: any) => {
                        // Add appid header for the shared runtime
                        if (appid) {
                            proxyReq.setHeader('x-laf-appid', appid)
                        }
                    },
                    logger: console
                } as any)

                proxyMiddleware(req, res, next)
                return
            } else {
                this.logger.warn(`Shared runtime is not running`)
                res.status(503).json({
                    error: 'Shared runtime is not available',
                    message: 'Please ensure the runtime is started'
                })
                return
            }
        })

        this.app.use((req, res) => {
            res.status(404).send('Not Found - Local Gateway')
        })

        try {
            this.server = this.app.listen(this.port, () => {
                this.logger.log(`Local Gateway started on port ${this.port}`)
            })

            this.server.on('upgrade', (req, socket, head) => {
                const host = req.headers.host
                if (!host) {
                    socket.destroy()
                    return
                }

                const hostname = host.split(':')[0]
                const appid = hostname.split('.')[0]

                // WebSocket upgrade to shared runtime
                const sharedRuntimePort = this.processManager.getSharedRuntimePort()

                if (this.processManager.isSharedRuntimeRunning()) {
                    this.logger.log(`WebSocket upgrade to shared runtime on localhost:${sharedRuntimePort}`)

                    const proxyMiddleware = createProxyMiddleware({
                        target: `http://localhost:${sharedRuntimePort}`,
                        changeOrigin: true,
                        ws: true,
                        onProxyReqWs: (proxyReq: any, req: any, socket: any) => {
                            // Add appid header for WebSocket connections
                            if (appid) {
                                proxyReq.setHeader('x-laf-appid', appid)
                            }
                        },
                        logger: console
                    } as any)

                    proxyMiddleware.upgrade(req, socket as any, head)
                } else {
                    this.logger.warn(`Shared runtime is not running for WebSocket upgrade`)
                    socket.destroy()
                }
            })

        } catch (err) {
            this.logger.error('Failed to start local gateway', err)
        }
    }
}
