export default function TranslationService({ enabled, checking, checked, available, disabled, healthMessage, onConnect, onDisable, onOpenSettings }: {
  enabled: boolean; checking: boolean; checked: boolean; available: boolean; disabled: boolean
  healthMessage: string; onConnect: () => void; onDisable: () => void; onOpenSettings: () => void
}) {
  const unavailable = checked && !available
  const reason = /凭证/u.test(healthMessage)
    ? '服务器需要连接凭证，请在连接设置中填写 HOSA_API_TOKEN。'
    : /未返回诊途|地址/u.test(healthMessage)
      ? '当前地址不是诊途 API，请检查后端地址。'
      : /超时|无法连接|连不上/u.test(healthMessage)
        ? '暂时无法连接翻译服务器，请检查后端地址和网络。'
        : '服务已连接，但当前方言暂无可用模型。医院短句仍可用。'
  return <div className={`translation-service ${enabled ? 'enabled' : ''}`}>
    <div className="service-main"><span role="status">{checking ? '正在连接整句翻译…' : enabled ? unavailable ? '当前方言整句服务暂不可用' : '整句翻译已开启'
      : unavailable ? '整句服务暂不可用，医院短句仍可用' : '需要翻译完整的一句话？'}</span>
      <button type="button" disabled={disabled || checking} onClick={enabled ? onDisable : onConnect}>
        {enabled ? '关闭整句翻译' : checking ? '连接中…' : checked ? '重新连接' : '一键开启'}
      </button>
    </div>
    {unavailable && healthMessage && <div className="service-health" role="status">
      <span>{reason}</span><button type="button" disabled={disabled} onClick={onOpenSettings}>打开连接设置</button>
    </div>}
    <p>{enabled ? '输入停顿后发送至已配置的增强翻译服务；重要信息请核对。' : '当前使用离线医院词库，常用短句无需服务器；未覆盖整句时可选开启增强翻译。'}</p>
  </div>
}
