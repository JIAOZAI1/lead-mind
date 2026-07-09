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

export const jobApi = {
  /** 新建作业：Cron 传 cronExpression，一次性传 runAt（UTC ISO 字符串，须为将来时间） */
  createJob(payload) {
    return request(`${JOB_BASE}/jobs`, { method: 'POST', body: payload })
  },

  /** 查询作业详情 */
  getJob(jobId) {
    return request(`${JOB_BASE}/jobs/${jobId}`)
  },

  /** 在作业下新建任务（绑定插件 DLL 与 Handler 类型，按 order 顺序执行） */
  createJobTask(jobId, payload) {
    return request(`${JOB_BASE}/jobs/${jobId}/tasks`, { method: 'POST', body: payload })
  },

  /** 查询作业下的任务列表（后端已按 order 排序） */
  listJobTasks(jobId) {
    return request(`${JOB_BASE}/jobs/${jobId}/tasks`)
  },

  /** 查询作业执行历史，limit 默认 20、最大 200 */
  listExecutions(jobId, limit = 20) {
    return request(`${JOB_BASE}/jobs/${jobId}/executions?limit=${limit}`)
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
