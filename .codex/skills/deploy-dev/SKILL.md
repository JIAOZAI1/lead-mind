---
name: deploy-dev
description: 用本地 kubectl 把最新镜像部署/更新到 dev 环境（apply 清单 + 滚动重启拉取 latest 镜像 + 等待就绪 + 验证）。当用户说"部署"、"发布"、"更新 dev 环境"、"deploy"时使用。
---

# 部署到 dev 环境

使用本地 kubectl（dev 集群 context 为 `default`），目标是让 dev 环境跑上 ghcr 上最新的镜像。按以下步骤执行：

## 1. 环境确认

```bash
kubectl config current-context
```

- 预期为 `default`（本地 dev 集群）；如果不是，**停下来向用户确认**，防止误部署到其他集群。

## 2. 首次部署检查（仅资源不存在时）

```bash
kubectl get secret ghcr-secret
```

- 若 `ghcr-secret` 不存在：ghcr 私有镜像拉不下来。向用户要一个含 `read:packages` 权限的 PAT，执行：

```bash
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io --docker-username=JIAOZAI1 --docker-password=<PAT>
```

- **禁止把 PAT 明文写进任何文件或提交记录。**

## 3. 应用清单 + 滚动更新

```bash
kubectl apply -f deploy/k8s/          # 清单变更幂等生效（首次部署即创建全部资源）
kubectl rollout restart deployment/lead-mind   # 强制拉取 latest 新镜像（imagePullPolicy: Always）
kubectl rollout status deployment/lead-mind --timeout=180s
```

- 注意：若本次部署的意图只是"清单有改动"，apply 后 rollout status 直接就绪的话可跳过 restart；**默认场景（发新版镜像）两步都要执行**。

## 4. 部署后验证

```bash
kubectl get pods -l app.kubernetes.io/name=lead-mind
# 确认 Pod 实际运行的镜像 digest 已更新（对比部署前后）
kubectl get pods -l app.kubernetes.io/name=lead-mind -o jsonpath='{.items[*].status.containerStatuses[*].imageID}'
```

- 向用户报告：Pod 状态、镜像 digest；
- dev 集群一般没有 Ingress 控制器，提示用户本地访问方式：

```bash
kubectl port-forward svc/lead-mind 8080:80   # 浏览器访问 http://localhost:8080
```

## 5. 失败排查

rollout 超时或 Pod 异常时按序检查，向用户说明原因后再处理：

- `ImagePullBackOff` → `ghcr-secret` 缺失/失效，或镜像还没构建出来（查 Actions 是否已推新镜像）；
- 探针失败反复重启 → `kubectl logs deployment/lead-mind` 看 nginx 报错；
- 其他 → `kubectl describe pod -l app.kubernetes.io/name=lead-mind` 看事件。

**回滚**：`kubectl rollout undo deployment/lead-mind`（上一版镜像层还在节点缓存，秒级恢复）。
