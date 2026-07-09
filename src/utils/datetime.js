// 时间解析与展示：后端所有时间均为 UTC，但部分字段序列化时丢了 Z 后缀
// （如 /status 的 nextRunAt，从数据库读出的 DateTime Kind=Unspecified），统一补 Z 再解析

/** 解析后端返回的 UTC 时间字符串为 Date；空值返回 null */
export function parseUtc(value) {
  if (!value) return null
  // 已带时区标记（Z 或 ±hh:mm）的原样解析，缺失的按 UTC 补 Z
  const normalized = /(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

/** 格式化为本地时区的 "YYYY-MM-DD HH:mm:ss"；空值显示占位符 */
export function formatDateTime(value, placeholder = '—') {
  const date = parseUtc(value)
  if (!date) return placeholder
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}
