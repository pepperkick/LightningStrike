#include <node_api.h>
#include <iostream>
#include <Windows.h>

#include "AURALightingSDK.h"

HMODULE hLib;

EnumerateMbControllerFunc EnumerateMbController;
SetMbModeFunc SetMbMode;
SetMbColorFunc SetMbColor;
GetMbColorFunc GetMbColor;
GetMbLedCountFunc GetMbLedCount;

MbLightControl *mbControllers = nullptr;
int32_t nbMbControllers = 0;

using namespace std;

napi_value _FindMbControllers(napi_env env, napi_callback_info info) {
  DWORD _count = EnumerateMbController(NULL, 0);
  napi_value mbCount;

  if (mbControllers == nullptr) {
      delete[] mbControllers;
  }
  
  mbControllers = new MbLightControl[_count];
  nbMbControllers = _count;

  EnumerateMbController(mbControllers, nbMbControllers);

  napi_create_int32(env, nbMbControllers, &mbCount);

  return mbCount;
}

napi_value _GetMbLedCount(napi_env env, napi_callback_info info) {
  napi_value ledCount, args[1];
  size_t argc = 1;
  int handle, count;

  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  napi_get_value_int32(env, args[0], &handle);

  if (handle + 1 > nbMbControllers) {
    napi_throw_error(env, NULL, "Requested handle ID does not exist");

    return 0;
  }

  count = GetMbLedCount(mbControllers[handle]);
  napi_create_int32(env, count, &ledCount);

  return ledCount;
}

napi_value _GetMbColor(napi_env env, napi_callback_info info) {
  BYTE* ledColors = new BYTE[6 * 3];
	ZeroMemory(ledColors, 6 * 3);
  napi_value values;
  
  for (size_t i = 0; i < 6 * 3; ++i)
  {
    ledColors[i] = 0x00;
  }

  int size = GetMbColor(mbControllers[0], ledColors, 6 * 3);

  napi_create_array_with_length(env, 6 * 3, &values);

  for (size_t i = 0; i < 6 * 3; ++i)
  {
    napi_value e;
    napi_create_int32(env, ledColors[i], &e);
    napi_set_element(env, values, i, e);
  }
  
  return values;
}

napi_value _SetMbColor(napi_env env, napi_callback_info info) {
  napi_value args[4];
  size_t argc = 4;
  int handle, r, g, b;
  BYTE* ledColors = new BYTE[6 * 3];
	ZeroMemory(ledColors, 6 * 3);

  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  napi_get_value_int32(env, args[0], &handle);
  napi_get_value_int32(env, args[1], &r);
  napi_get_value_int32(env, args[2], &g);
  napi_get_value_int32(env, args[3], &b);

  for (size_t i = 0; i < 6; ++i) {
    ledColors[i * 3 + 0] = (BYTE) r;
    ledColors[i * 3 + 1] = (BYTE) g;
    ledColors[i * 3 + 2] = (BYTE) b;
  }

  if (handle + 1 > nbMbControllers) {
    napi_throw_error(env, NULL, "Requested handle ID does not exist");

    return 0;
  }

	SetMbMode(mbControllers[0], 1);
  int status = SetMbColor(mbControllers[0], ledColors, 6 * 3);

  return 0;
}

napi_value _SetMbColorAll(napi_env env, napi_callback_info info) {
  napi_value args[3];
  size_t argc = 3;
  int handle;
  uint32_t ledSize;
  BYTE* ledColors = new BYTE[70 * 3];
	ZeroMemory(ledColors, 70 * 3);

  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  napi_get_value_int32(env, args[0], &handle);
  napi_get_array_length(env, args[1], &ledSize);

  for (size_t i = 0; i < ledSize; ++i) {
    napi_value element;
    int value;
    
    napi_get_element(env, args[1], i , &element);
    napi_get_value_int32(env, element, &value);

    ledColors[i] = (BYTE) value;
  }

  if (handle + 1 > nbMbControllers) {
    napi_throw_error(env, NULL, "Requested handle ID does not exist");

    return 0;
  }

	SetMbMode(mbControllers[0], 1);
  int status = SetMbColor(mbControllers[0], ledColors, 70 * 3);

  return 0;
}

napi_value _Init(napi_env env, napi_callback_info info) {
  printf("[AURA] Loading Library...\n");

  hLib = LoadLibrary("G:\\Projects\\LightningStrike\\files\\AURA_SDK.dll");

  if (hLib == nullptr) {
      napi_throw_error(env, NULL, "Unable to create aura libary");
  }

  (FARPROC &)EnumerateMbController = GetProcAddress(hLib, "EnumerateMbController");
  (FARPROC &)SetMbMode = GetProcAddress(hLib, "SetMbMode");
  (FARPROC &)SetMbColor = GetProcAddress(hLib, "SetMbColor");
  (FARPROC &)GetMbColor = GetProcAddress(hLib, "GetMbColor");
  (FARPROC &)GetMbLedCount = GetProcAddress(hLib, "GetMbLedCount");

  printf("[AURA] Library Loaded!\n");

  return 0;
}

napi_value _UnInit(napi_env env, napi_callback_info info) {
  printf("[AURA] Unloading Library...\n");

	FreeLibrary(hLib);

  printf("[AURA] Library Unloaded!\n");

  return 0;
}
napi_value Init(napi_env env, napi_value exports) {
  napi_status status;
  napi_value fn1, fn2, fn3, fn4, fn5, fn6, fn7;

  status = napi_create_function(env, NULL, 0, _Init, NULL, &fn1);
  status = napi_create_function(env, NULL, 0, _UnInit, NULL, &fn7);
  status = napi_create_function(env, NULL, 0, _FindMbControllers, NULL, &fn2);
//   status = napi_create_function(env, NULL, 0, _SetMbMode, NULL, &fn3);
  status = napi_create_function(env, NULL, 0, _GetMbLedCount, NULL, &fn4);
  status = napi_create_function(env, NULL, 0, _GetMbColor, NULL, &fn5);
  status = napi_create_function(env, NULL, 0, _SetMbColor, NULL, &fn6);

  if (status != napi_ok) {
    napi_throw_error(env, NULL, "Unable to wrap native function");
  }

  status = napi_set_named_property(env, exports, "Init", fn1);
  status = napi_set_named_property(env, exports, "Shutdown", fn7);
  status = napi_set_named_property(env, exports, "FindMbControllers", fn2);
  // status = napi_set_named_property(env, exports, "SetMbMode", fn3);
  status = napi_set_named_property(env, exports, "GetMbLedCount", fn4);
  status = napi_set_named_property(env, exports, "GetMbColor", fn5);
  status = napi_set_named_property(env, exports, "SetMbColor", fn6);
  
  if (status != napi_ok) {
    napi_throw_error(env, NULL, "Unable to populate exports");
  }

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)