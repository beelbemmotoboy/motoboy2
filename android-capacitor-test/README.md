# Beelbem Motoboy Android Test

Projeto Android isolado com Capacitor para testar o build web do Beelbem Motoboy sem alterar o app principal.

## Atualizar o app web dentro do Android

Copie o conteudo de `..\dist` para `www` e depois rode:

```powershell
npm run sync
```

## Abrir no Android Studio

```powershell
npm run open
```

## Gerar APK de teste

```powershell
cd android
.\gradlew.bat assembleDebug
```

APK gerado em:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

## Observacao

Este projeto usa o build estatico que estiver em `www`. Para refletir mudancas novas do app principal, gere o build no projeto principal e copie novamente para `www`.
