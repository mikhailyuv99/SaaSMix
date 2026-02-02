/**
 * HISE VST3 Host - Console app to process a WAV file through a VST3 plugin.
 * Usage: hise_vst3_host.exe <plugin.vst3> <input.wav> <output.wav> [block_size]
 * For use with SaaS Mix backend: Python calls this exe for identical HISE rendering.
 */
#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_audio_formats/juce_audio_formats.h>
#include <juce_core/juce_core.h>
#include <cstdlib>
#include <iostream>

using namespace juce;

static const int kDefaultBlockSize = 1024;

static void usage(const char* exe) {
  std::cerr << "Usage: " << exe << " <plugin.vst3> <input.wav> <output.wav> [block_size]\n"
            << "  block_size default: " << kDefaultBlockSize << "\n";
}

int main(int argc, char* argv[]) {
  if (argc < 4) {
    usage(argv[0]);
    return 1;
  }

  const String pluginPath(argv[1]);
  const String inputPath(argv[2]);
  const String outputPath(argv[3]);
  const int blockSize = (argc >= 5) ? std::atoi(argv[4]) : kDefaultBlockSize;

  if (blockSize < 64 || blockSize > 65536) {
    std::cerr << "block_size must be between 64 and 65536\n";
    return 1;
  }

  File pluginFile(pluginPath);
  File inputFile(inputPath);
  File outputFile(outputPath);

  if (!pluginFile.exists()) {
    std::cerr << "Plugin not found: " << pluginPath << "\n";
    return 1;
  }
  if (!inputFile.existsAsFile()) {
    std::cerr << "Input file not found: " << inputPath << "\n";
    return 1;
  }

  AudioPluginFormatManager formatManager;
  formatManager.addDefaultFormats();

  AudioPluginFormat* vst3Format = nullptr;
  for (int i = 0; i < formatManager.getNumFormats(); ++i) {
    if (formatManager.getFormat(i)->getName() == "VST3") {
      vst3Format = formatManager.getFormat(i);
      break;
    }
  }
  if (!vst3Format) {
    std::cerr << "VST3 format not available\n";
    return 1;
  }

  OwnedArray<PluginDescription> typesFound;
  vst3Format->findAllTypesForFile(typesFound, pluginPath);
  if (typesFound.isEmpty()) {
    std::cerr << "No plugin found in: " << pluginPath << "\n";
    return 1;
  }

  String errorMessage;
  std::unique_ptr<AudioPluginInstance> instance(
      formatManager.createPluginInstance(*typesFound.getFirst(), 48000.0, blockSize, errorMessage));
  if (!instance) {
    std::cerr << "Failed to load plugin: " << errorMessage << "\n";
    return 1;
  }

  const double sampleRate = 48000.0;
  const int numChannels = 2;
  instance->setPlayConfigDetails(0, numChannels, sampleRate, blockSize);
  instance->prepareToPlay(sampleRate, blockSize);
  instance->setNonRealtime(false);

  // Read WAV
  AudioFormatManager wavManager;
  wavManager.registerBasicFormats();
  std::unique_ptr<AudioFormatReader> reader(wavManager.createReaderFor(inputFile));
  if (!reader) {
    std::cerr << "Could not read input file (not WAV or unsupported)\n";
    return 1;
  }

  const int64 totalSamples = reader->lengthInSamples;
  const int numChannelsIn = (int)reader->numChannels;
  const double fileSampleRate = reader->sampleRate;

  AudioBuffer<float> fileBuffer(numChannelsIn, (int)totalSamples);
  if (!reader->read(&fileBuffer, 0, (int)totalSamples, 0, true, true)) {
    std::cerr << "Failed to read audio data\n";
    return 1;
  }

  // Resample to 48 kHz if needed (simple linear interpolation for demo; for production use a proper resampler)
  AudioBuffer<float> workBuffer;
  double sr = fileSampleRate;
  if (std::abs(sr - sampleRate) > 0.5) {
    const double ratio = sampleRate / sr;
    const int newLength = (int)std::round(totalSamples * ratio);
    workBuffer.setSize(numChannelsIn, newLength);
    for (int c = 0; c < numChannelsIn; ++c) {
      for (int i = 0; i < newLength; ++i) {
        double src = i / ratio;
        int i0 = (int)src;
        float f = (float)(src - i0);
        if (i0 >= (int)totalSamples - 1) i0 = (int)totalSamples - 2;
        workBuffer.setSample(c, i, fileBuffer.getSample(c, i0) * (1.f - f) + fileBuffer.getSample(c, i0 + 1) * f);
      }
    }
    sr = sampleRate;
  } else {
    workBuffer.makeCopyOf(fileBuffer);
  }

  const int totalFrames = workBuffer.getNumSamples();
  AudioBuffer<float> processBuffer(numChannels, blockSize);
  MidiBuffer midi;
  AudioBuffer<float> outBuffer(numChannels, totalFrames);
  outBuffer.clear();

  for (int offset = 0; offset < totalFrames; offset += blockSize) {
    const int thisBlock = std::min(blockSize, totalFrames - offset);
    processBuffer.clear();
    for (int c = 0; c < numChannels; ++c) {
      int srcCh = (c < workBuffer.getNumChannels()) ? c : 0;  // Mono: duplique canal 0 sur les deux
      processBuffer.copyFrom(c, 0, workBuffer, srcCh, offset, thisBlock);
    }
    if (thisBlock < blockSize)
      processBuffer.clear(thisBlock, blockSize - thisBlock);
    instance->processBlock(processBuffer, midi);
    for (int c = 0; c < numChannels; ++c)
      outBuffer.copyFrom(c, offset, processBuffer, c, 0, thisBlock);
  }

  instance->releaseResources();

  // Resample back to file sample rate if we upsampled
  AudioBuffer<float>* writeBuffer = &outBuffer;
  std::unique_ptr<AudioBuffer<float>> resampledBack;
  if (std::abs(fileSampleRate - sampleRate) > 0.5) {
    const double ratio = fileSampleRate / sampleRate;
    const int outLength = (int)std::round(totalFrames * ratio);
    resampledBack = std::make_unique<AudioBuffer<float>>(numChannels, outLength);
    for (int c = 0; c < numChannels; ++c) {
      for (int i = 0; i < outLength; ++i) {
        double src = i / ratio;
        int i0 = (int)src;
        float f = (float)(src - i0);
        if (i0 >= totalFrames - 1) i0 = totalFrames - 2;
        resampledBack->setSample(c, i, outBuffer.getSample(c, i0) * (1.f - f) + outBuffer.getSample(c, i0 + 1) * f);
      }
    }
    writeBuffer = resampledBack.get();
  }

  outputFile.deleteFile();
  std::unique_ptr<FileOutputStream> fos(outputFile.createOutputStream());
  if (!fos || !fos->openedOk()) {
    std::cerr << "Could not create output file\n";
    return 1;
  }
  WavAudioFormat wavFormat;
  std::unique_ptr<AudioFormatWriter> writer(
      wavFormat.createWriterFor(fos.get(), fileSampleRate, (unsigned int)writeBuffer->getNumChannels(), 16, {}, 0));
  if (!writer) {
    std::cerr << "Could not create WAV writer\n";
    return 1;
  }
  fos.release();
  bool ok = writer->writeFromFloatArrays(
      writeBuffer->getArrayOfReadPointers(), (int)writeBuffer->getNumChannels(), writeBuffer->getNumSamples());
  writer.reset();
  if (!ok) {
    std::cerr << "Failed to write output file\n";
    return 1;
  }

  return 0;
}
