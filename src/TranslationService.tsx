export default function TranslationService({ enabled, checking, checked, available, disabled, onConnect, onDisable }: {
  enabled: boolean; checking: boolean; checked: boolean; available: boolean; disabled: boolean
  onConnect: () => void; onDisable: () => void
}) {
  return <div className={`translation-service ${enabled ? 'enabled' : ''}`}>
    <div className="service-main"><span role="status">{checking ? '正在连接整句翻译…' : enabled ? checked && !available ? '当前方言整句服务暂不可用' : '整句翻译已开启'
      : checked && !available ? '整句服务暂不可用，医院短句仍可用' : '需要翻译完整的一句话？'}</span>
      <button type="button" disabled={disabled || checking} onClick={enabled ? onDisable : onConnect}>
        {enabled ? '关闭整句翻译' : checking ? '连接中…' : checked ? '重新连接' : '一键开启'}
      </button>
    </div>
    <p>{enabled ? '输入停顿后发送至翻译服务；重要信息请核对。' : '点击开启后，输入文字会发送至已配置的翻译服务。'}</p>
  </div>
}
