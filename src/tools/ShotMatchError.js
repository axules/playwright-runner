export default class ShotMatchError extends Error {
  constructor(name, count, diff) {
    super('Screenshots have diffirence');
    this.diffName = name;
    this.diffResult = diff;
    this.diffCount = count;
    this.name = 'ShotMatchError';
  }
}
