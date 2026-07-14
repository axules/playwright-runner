import { test } from '@playwright/test';

import { PageRunner } from '../src/runner';


test('Check login and registration forms', async ({ page }) => {
  await PageRunner.create(page, { debug: true })
    .goto('https://zapiski.online')
    .within('.cookiesNotification')
    .expectText('Мы используем cookies для работы сервиса. Продолжая пользоваться сервисом ЗапискиОнлайн, вы принимаете')
    .click('button')
    .dontSeeElement()
    .reloadPage()
    .dontSeeElement()
    .within('#login_frame')
    .expectText('Войти')
    .click('li:@text(Регистрация)')
    .expectText('Повторите пароль')
    .sayWhere()
    .sayFullPath()
    .expectFetch('/json/m_authf/aj_get_info', {}, { status: 200 })
    .act(async ({ page }) => {
      await page.setViewportSize({ width: 640, height: 640 });
    });
});
