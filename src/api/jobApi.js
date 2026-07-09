// backend-job-service 作业调度接口封装
// 接口契约见后端仓库 services/backend-job-service/README.md
import { API_ORIGIN, request } from './http'

const JOB_BASE = `${API_ORIGIN}/backend-job-service/api/v1`

// 后端未注册 JsonStringEnumConverter，枚举一律用数字收发
export const SCHEDULE_TYPE = { CRON: 1, ONE_TIME: 2 }

/** 调度类型展示元数据：label 文案 + AxTag type */
export const SCHEDULE_TYPE_META = {
  [SCHEDULE_TYPE.CRON]: { label: 'Cron 周期', tag: 'primary' },
  [SCHEDULE_TYPE.ONE_TIME]: { label: '一次性', tag: 'default' },
}

/** 作业状态（Enabled/Disabled） */
export const JOB_STATUS_META = {
  1: { label: '启用', tag: 'success' },
  2: { label: '停用', tag: 'default' },
}

/** 作业单次执行状态（JobExecution.Status） */
export const EXECUTION_STATUS_META = {
  1: { label: '等待中', tag: 'default' },
  2: { label: '执行中', tag: 'primary' },
  3: { label: '成功', tag: 'success' },
  4: { label: '失败', tag: 'error' },
}

/** 任务执行状态（TaskExecution.Status，比作业执行多一档超时） */
export const TASK_EXECUTION_STATUS_META = {
  1: { label: '等待中', tag: 'default' },
  2: { label: '执行中', tag: 'primary' },
  3: { label: '成功', tag: 'success' },
  4: { label: '失败', tag: 'error' },
  5: { label: '超时', tag: 'warning' },
}

/**
 * 组装分页 + 排序 query。后端约定（规范 16.4 节）：page/pageSize/sortBy/sortOrder 四参数，
 * sortBy 走白名单校验（非法字段返回 400），sortOrder 为 asc/desc（后端大小写不敏感）。
 * sortBy 与 sortOrder 必须成对显式传递：后端 sortOrder 缺省时枚举默认值不是 asc，不能依赖。
 */
function buildPagedQuery({ page = 1, pageSize = 20, sortBy, sortOrder } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  if (sortBy) {
    query.set('sortBy', sortBy)
    query.set('sortOrder', sortOrder === 'desc' ? 'desc' : 'asc')
  }
  return query
}

function normalizePagedResult(data) {
  if (Array.isArray(data)) return { items: data, total: data.length }
  const items = data?.items ?? data?.records ?? data?.data ?? data?.list ?? []
  return {
    items,
    page: data?.page,
    pageSize: data?.pageSize,
    total: data?.total ?? data?.totalCount ?? data?.count ?? items.length,
  }
}

export const jobApi = {
  /** 新建作业：Cron 传 cronExpression，一次性传 runAt（UTC ISO 字符串，须为将来时间） */
  createJob(payload) {
    return request(`${JOB_BASE}/jobs`, { method: 'POST', body: payload })
  },

  /** 分页查询作业列表；可排序字段：id/name/status/createdAt/updatedAt/nextRunAt，默认 id 倒序（维持原有展示顺序） */
  listJobs({ page = 1, pageSize = 20, sortBy = 'id', sortOrder = 'desc' } = {}) {
    const query = buildPagedQuery({ page, pageSize, sortBy, sortOrder })
    return request(`${JOB_BASE}/jobs?${query}`).then(normalizePagedResult)
  },

  /** 查询作业详情 */
  getJob(jobId) {
    return request(`${JOB_BASE}/jobs/${jobId}`)
  },

  /** 更新作业基础信息与状态 */
  updateJob(jobId, payload) {
    return request(`${JOB_BASE}/jobs/${jobId}`, { method: 'PUT', body: payload })
  },

  /** 删除作业（后端软删除） */
  deleteJob(jobId) {
    return request(`${JOB_BASE}/jobs/${jobId}`, { method: 'DELETE' })
  },

  /** 在作业下新建任务（绑定插件 DLL 与 Handler 类型，按 order 顺序执行） */
  createJobTask(jobId, payload) {
    return request(`${JOB_BASE}/jobs/${jobId}/tasks`, { method: 'POST', body: payload })
  },

  /** 更新作业任务 */
  updateJobTask(jobId, taskId, payload) {
    return request(`${JOB_BASE}/jobs/${jobId}/tasks/${taskId}`, { method: 'PUT', body: payload })
  },

  /** 删除作业任务（后端软删除） */
  deleteJobTask(jobId, taskId) {
    return request(`${JOB_BASE}/jobs/${jobId}/tasks/${taskId}`, { method: 'DELETE' })
  },

  /** 分页查询作业下的任务列表；可排序字段：id/name/order/createdAt/updatedAt，默认按顺序号升序（与执行顺序一致） */
  listJobTasks(jobId, { page = 1, pageSize = 20, sortBy = 'order', sortOrder = 'asc' } = {}) {
    const query = buildPagedQuery({ page, pageSize, sortBy, sortOrder })
    return request(`${JOB_BASE}/jobs/${jobId}/tasks?${query}`).then(normalizePagedResult)
  },

  /** 分页查询作业执行历史；后端固定按触发时间倒序，不支持自定义排序字段 */
  listExecutions(jobId, { page = 1, pageSize = 20 } = {}) {
    const query = buildPagedQuery({ page, pageSize })
    return request(`${JOB_BASE}/jobs/${jobId}/executions?${query}`).then(normalizePagedResult)
  },

  /** 作业状态聚合视图（作业状态 + 最近一次执行及其任务状态），后端专供前端轮询 */
  getJobStatus(jobId) {
    return request(`${JOB_BASE}/jobs/${jobId}/status`)
  },

  /** 查询单次执行详情（含每个任务的执行状态） */
  getExecution(executionId) {
    return request(`${JOB_BASE}/executions/${executionId}`)
  },
}
