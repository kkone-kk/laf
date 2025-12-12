// Mock types
export interface KubernetesObject {
    apiVersion?: string;
    kind?: string;
    metadata?: any;
    spec?: any;
}
export interface V1ObjectMeta {
    name?: string;
    namespace?: string;
    [key: string]: any;
}

export interface Condition {
    type: string
    status: string
    lastTransitionTime?: string
    reason?: string
    message?: string
}

export class GroupVersionKind {
    group: string
    version: string
    kind: string
    plural: string

    constructor(group: string, version: string, kind: string, plural?: string) {
      this.group = group
      this.version = version
      this.kind = kind
      this.plural = plural || kind.toLowerCase() + 's'
    }

    static fromKubernetesObject(obj: KubernetesObject): GroupVersionKind {
      const [group, version] = (obj.apiVersion || 'v1').split('/')
      if (!version) {
        return new GroupVersionKind('', group, obj.kind)
      }
      return new GroupVersionKind(group, version, obj.kind)
    }
}
