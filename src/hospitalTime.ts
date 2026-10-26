// Matching grammar only: never convert, round or resolve these literals. Keep
// approximate words, ranges, half units and compound units exactly as entered.
const number = '(?:[0-9０-９]{1,3}(?:[.．][0-9０-９]{1,2})?|[一二三四五六七八九十百两兩]{1,4})'
const amount = `(?:${number}(?:到|至|[-–—~～])${number}|${number}|半)`
const hour = '(?:个|個)?(?:小时|小時)'
const minute = '(?:分钟|分鐘)'
const second = '(?:秒钟|秒鐘|秒)'
const month = '(?:个月|個月)'
const unit = `(?:${minute}|${second}|${hour}|天|周|星期|${month}|年)`
const compound = `(?:${number}年${number}${month}|${number}天${number}${hour}|${number}${hour}${number}${minute}|${number}${minute}${number}${second})`
const half = `(?:${number}(?:个|個)?半(?:小时|小時|月)|${number}(?:${hour}|天|周|星期|${month}|年)半)`
export const durationPattern = `(?:(?:大约|大約|大概|约|約|差不多))?(?:${compound}|${half}|${amount}${unit})(?:左右)?`
export const onsetPattern = `(?:今天(?:早上|上午|中午|下午|晚上)?|昨天(?:早上|上午|中午|下午|晚上)?|前天|今早|昨晚|今晚|${durationPattern}前)`
// A time scope does not assert when the symptom started or stopped. A bare
// duration cannot be a scope: require an explicit “过去/最近/这…” marker.
export const timeScopePattern = `(?:今天(?:早上|上午|中午|下午|晚上)?|昨天(?:早上|上午|中午|下午|晚上)?|前天|今早|昨晚|今晚|刚才|剛才|(?:过去|過去|最近|近|这|這)${durationPattern})`
