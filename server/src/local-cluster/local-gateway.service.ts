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

        // Proxy for runtime
        this.app.use((req, res, next) => {
            const host = req.hostname
            // Assuming host is like appid.127.0.0.1.nip.io or appid.localhost
            const appid = host.split('.')[0]

            this.logger.log(`Incoming request: host=${host}, appid=${appid}, path=${req.path}`)

            const port = this.processManager.getPort(appid)

            if (port) {
                this.logger.log(`Proxying request for ${host} to localhost:${port}`)
                createProxyMiddleware({
                    target: `http://localhost:${port}`,
                    changeOrigin: true,
                    ws: true,
                    logger: console
                })(req, res, next)
            } else {
                // Check if it is a website hosting request (not implemented yet)
                // or just 404
                this.logger.warn(`No process found for ${appid} (host: ${host})`)
                next()
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
                const port = this.processManager.getPort(appid)

                if (port) {
                    createProxyMiddleware({
                        target: `http://localhost:${port}`,
                        changeOrigin: true,
                        ws: true,
                        logger: console
                    }).upgrade(req, socket as any, head)
                } else {
                    socket.destroy()
                }
            })

        } catch (err) {
            this.logger.error('Failed to start local gateway', err)
        }
    }
}
