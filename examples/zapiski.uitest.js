import {test} from "@playwright/test";
import {newRunner} from "../src/runner";

test('Mobile and geolocation', async ({ page }) => {
  await newRunner(page)
    .goto('https://zapiski.online')
    .containsText('Войти')
    .pause()
    .click('Регистрация')
    .containsText('Повторите пароль')
    .run();
});