# ========== 构建阶段：安装依赖并产出 dist ==========
FROM node:22-alpine AS builder
WORKDIR /app

# 先只拷贝依赖清单再安装，代码改动不会破坏依赖层缓存
COPY package.json package-lock.json ./

# @jiaozai1/axis-ui 发布在 GitHub Packages，安装需要认证：
# 通过 BuildKit secret 挂载 token（构建命令用 --secret 传入），
# .npmrc 写完即删，token 不会残留在任何镜像层
RUN --mount=type=secret,id=npm_token \
    printf '@jiaozai1:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n' "$(cat /run/secrets/npm_token)" > /root/.npmrc \
    && npm ci \
    && rm -f /root/.npmrc

COPY . .
RUN npm run build

# ========== 运行阶段：nginx 托管静态产物 ==========
FROM nginx:1.27-alpine

# SPA 专用 nginx 配置（路由回退 + 静态资源缓存 + gzip）
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# 容器健康检查：首页可访问即视为存活
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
