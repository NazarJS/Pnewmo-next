

Контекст: Задача по реализации Loading для корректного UX каталога была выполнена корректно.
При смене категории <Suspense> отображается и после него меняется категория товаров


Проблема в отображении ошибки в консоли браузера: 

При смене категорий и отображения <Suspense> браузер выдает в консоли ошибку: 

installHook.js:1 React instrumentation encountered an error: Error: We are cleaning up async info that was not on the parent Suspense boundary. This is a bug in React.
    at removePreviousSuspendedBy (installHook.js:1:100230)
    at updateFiberRecursively (installHook.js:1:121237)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
    at updateVirtualChildrenRecursively (installHook.js:1:116478)
    at updateChildrenRecursively (installHook.js:1:116917)
    at updateFiberRecursively (installHook.js:1:120463)
overrideMethod	@	installHook.js:1
﻿

P.S. Сама ошибка не влияет на работу проекта в браузере

Задача: Дать полный отчет того с чем связано отображение данной ошибки в консоли, влияние ее на дальнейшую работу приложения и варианты исправления 

