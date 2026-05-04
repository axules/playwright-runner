import {test} from "@playwright/test";
import {newRunner} from "../src/runner";

test('Check login and registration forms', async ({ page }) => {
  await newRunner(page, { debug: true })
    .goto('https://zapiski.online')
    .moveToChild('.cookiesNotification')
    .seeText('Мы используем cookies для работы сервиса. Продолжая пользоваться сервисом ЗапискиОнлайн, вы принимаете')
    .click('button')
    .dontSee()
    .reloadPage()
    .dontSee()
    .moveTo('#login_frame')
    .seeText('Войти')
    .click('"Регистрация"')
    .seeText('Повторите пароль')
    .fullWay()
    .run();
});