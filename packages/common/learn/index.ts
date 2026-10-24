export interface ReaultLearn {
  wordNumber: number; //返回更新完成之后的单词数量
  dayNumber: number; //返回打卡天数
  checkedIn?: boolean; //本次是否触发了新打卡
}
