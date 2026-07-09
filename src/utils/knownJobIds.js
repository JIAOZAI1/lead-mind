// 本地已知作业 ID 存储：后端暂无「作业列表」接口（只能按 ID 查询），
// 前端把本浏览器创建过/手动添加过的作业 ID 记在 localStorage，进页面时逐个拉详情拼出列表。
// 后端补列表接口后此文件可删除。

const STORAGE_KEY = 'lead-mind:known-job-ids'

/** 读取已知作业 ID 列表（数字数组，按添加顺序） */
export function loadKnownJobIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id) && id > 0) : []
  } catch {
    return []
  }
}

/** 记录一个作业 ID（去重） */
export function addKnownJobId(id) {
  const ids = loadKnownJobIds()
  if (!ids.includes(id)) {
    ids.push(id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  }
}

/** 移除一个作业 ID（后端查不到时自动清理） */
export function removeKnownJobId(id) {
  const ids = loadKnownJobIds().filter((known) => known !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}
