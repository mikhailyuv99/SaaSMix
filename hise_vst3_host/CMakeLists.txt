# HISE VST3 Host - console app that loads a VST3 and processes a WAV file.
# For use with the SaaS Mix backend (Python calls this exe for identical HISE rendering).
cmake_minimum_required(VERSION 3.22)
project(hise_vst3_host VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)

# Option 1: Use JUCE from GitHub (recommended for build-from-scratch / CI)
option(USE_JUCE_FETCH "Fetch JUCE from GitHub" ON)
# Option 2: Use existing JUCE (e.g. HISE SourceCode) - set JUCE_PATH
set(JUCE_PATH "" CACHE PATH "Path to JUCE source (if not using fetch)")

if(USE_JUCE_FETCH)
  include(FetchContent)
  # Téléchargement en ZIP (pas besoin de Git)
  FetchContent_Declare(
    JUCE
    URL https://github.com/juce-framework/JUCE/archive/refs/tags/7.0.10.zip
  )
  set(FETCHCONTENT_QUIET OFF)
  set(JUCE_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
  set(JUCE_BUILD_EXTRAS OFF CACHE BOOL "" FORCE)
  set(JUCE_ENABLE_GPL_MODE ON CACHE BOOL "" FORCE)
  FetchContent_MakeAvailable(JUCE)
else()
  if(NOT JUCE_PATH OR NOT EXISTS "${JUCE_PATH}/CMakeLists.txt")
    message(FATAL_ERROR "Set JUCE_PATH to a JUCE source tree (with CMakeLists.txt) or enable USE_JUCE_FETCH")
  endif()
  add_subdirectory(${JUCE_PATH} ${CMAKE_BINARY_DIR}/JUCE)
endif()

# Console app: hise_vst3_host.exe
juce_add_console_app(hise_vst3_host
  PRODUCT_NAME "HISE VST3 Host"
  COMPANY_NAME "SaaS Mix"
  VERSION "1.0.0"
  BUNDLE_ID "com.saasmix.hise_vst3_host"
)

target_sources(hise_vst3_host PRIVATE main.cpp)

target_compile_definitions(hise_vst3_host PRIVATE
  JUCE_USE_CURL=0
  JUCE_DISABLE_JUCE_VERSION_PRINTING=1
  JUCE_WEB_BROWSER=0
)

# Host VST3 only (no AU/VST2 needed on Windows)
target_compile_definitions(hise_vst3_host PRIVATE
  JUCE_PLUGINHOST_VST3=1
  JUCE_PLUGINHOST_VST=0
  JUCE_PLUGINHOST_AU=0
)

target_link_libraries(hise_vst3_host PRIVATE
  juce::juce_audio_utils
  juce::juce_audio_formats
  juce::juce_audio_processors
  juce::juce_recommended_config_flags
  juce::juce_recommended_warning_flags
)

if(MSVC)
  target_compile_options(hise_vst3_host PRIVATE /bigobj)
endif()
