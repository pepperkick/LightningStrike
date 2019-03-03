#include <node_api.h>
#include <iostream>
#include <Windows.h>
#include "LogitechLEDLib.h"

#define USE_DLL

#ifndef USE_DLL
#pragma comment(lib, "G:\\Projects\\LightningStrike\\files\\LogitechLEDLib.lib")

#else
typedef BOOL (* LPFNDLLINIT)();
typedef BOOL (* LPFNDLLSETLIGHTING)(int, int, int);
typedef BOOL (* LPFNDLLSETLIGHTINGZONE)(int, int, int, int, int);
typedef void (* LPFNDLLSHUTDOWN)();

LPFNDLLINIT g_lpfnDllInit = NULL;
LPFNDLLSETLIGHTING g_lpfnDllSetLighting = NULL;
LPFNDLLSETLIGHTINGZONE g_lpfnDllSetLightingZone = NULL;
LPFNDLLSHUTDOWN g_lpfnDllShutdown = NULL;
#endif

napi_value _SetColor(napi_env env, napi_callback_info info) {
  napi_value args[3];
  size_t argc = 3;
  int r, g, b;

  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  napi_get_value_int32(env, args[0], &r);
  napi_get_value_int32(env, args[1], &g);
  napi_get_value_int32(env, args[2], &b);

  #ifndef USE_DLL
  LogiLedSetLighting(r, g, b);
  #else
  g_lpfnDllSetLighting(r, g, b);
  #endif

  return 0;
}

napi_value _SetColorForZone(napi_env env, napi_callback_info info) {
  napi_value args[5];
  size_t argc = 5;
  int r, g, b, d, z;

  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  napi_get_value_int32(env, args[0], &d);
  napi_get_value_int32(env, args[1], &z);
  napi_get_value_int32(env, args[2], &r);
  napi_get_value_int32(env, args[3], &g);
  napi_get_value_int32(env, args[4], &b);

  if (d == 3) {
    d = 0x8;
  }

  #ifndef USE_DLL
  LogiLedSetLightingForTargetZone(r, g, b);
  #else
  g_lpfnDllSetLightingZone(d, z, r, g, b);
  #endif

  return 0;
}

napi_value _Init(napi_env env, napi_callback_info info) {
  printf("[LOGITECH[ Loading Library...\n");

  bool result = false;

  #ifndef USE_DLL
  result = LogiLedInit();
  #else
  HINSTANCE logiDllHandle = LoadLibrary("G:\\Projects\\LightningStrike\\files\\LogitechLed.dll");
  if (logiDllHandle != NULL)
  {
      g_lpfnDllInit = (LPFNDLLINIT)GetProcAddress(logiDllHandle, "LogiLedInit");
      g_lpfnDllSetLighting = (LPFNDLLSETLIGHTING)GetProcAddress(logiDllHandle, "LogiLedSetLighting");
      g_lpfnDllSetLightingZone = (LPFNDLLSETLIGHTINGZONE)GetProcAddress(logiDllHandle, "LogiLedSetLightingForTargetZone");
      g_lpfnDllShutdown = (LPFNDLLSHUTDOWN)GetProcAddress(logiDllHandle, "LogiLedShutdown");

      result = g_lpfnDllInit();
  }
  #endif

  if (!result) {
    napi_throw_error(env, NULL, "Failed to load library");
  }
  
  printf("[LOGITECH] Library Loaded!\n");

  return 0;
}

napi_value _UnInit(napi_env env, napi_callback_info info) {
  printf("[LOGITECH[ Unloading Library...\n");

  #ifndef USE_DLL
  LogiLedShutdown();
  #else
  g_lpfnDllShutdown();
  #endif
  
  printf("[LOGITECH] Library Unloaded!\n");

  return 0;
}

napi_value Init(napi_env env, napi_value exports) {
  napi_status status;
  napi_value fn1, fn2, fn3, fn4;

  status = napi_create_function(env, NULL, 0, _Init, NULL, &fn1);
  status = napi_create_function(env, NULL, 0, _UnInit, NULL, &fn2);
  status = napi_create_function(env, NULL, 0, _SetColor, NULL, &fn3);
  status = napi_create_function(env, NULL, 0, _SetColorForZone, NULL, &fn4);

  if (status != napi_ok) {
    napi_throw_error(env, NULL, "Unable to wrap native function");
  }

  status = napi_set_named_property(env, exports, "Init", fn1);
  status = napi_set_named_property(env, exports, "Shutdown", fn2);
  status = napi_set_named_property(env, exports, "SetColor", fn3);
  status = napi_set_named_property(env, exports, "SetColorZone", fn4);
  
  if (status != napi_ok) {
    napi_throw_error(env, NULL, "Unable to populate exports");
  }

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)