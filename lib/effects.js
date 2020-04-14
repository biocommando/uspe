const fx = sampleRate => {
	return {
		delay: (delaymillis, feed, wet) => {
			const buffer = [0,0].map(() => Array(Math.floor(delaymillis / 1000 * sampleRate)).fill(0));
			let idx = 0;
			return (x, ch, total_n_ch) => {
				if (idx === buffer[ch].length)
					idx = 0;
				const b = buffer[ch][idx];
				buffer[ch][idx] = buffer[ch][idx] * feed + x;
				idx = idx + ((total_n_ch === 1 || ch === 1) ? 1 : 0);
				return x * (1 - wet) + b * wet;
			};
		},

		distortion: (gain, clip) => (x => Math.min(Math.max(gain * x, -clip), clip)),

		overdrive: gain => x => Math.min(Math.max(gain * x * x * x, -1), 1),

		flanger: (frequencyHz, delay0to1, depth0to1, wet, stereoOffset = 0) => {
            const flanger1Ch = (frequencyHz, delay0to1, depth0to1, wet, initialPhase) => {
                const frequency = frequencyHz / sampleRate * Math.PI * 2;
                const delay = 200 * delay0to1;
                const depth = 200 * depth0to1;
                let phase = 0;
                let index = 0;
                const buffer = Array(600).fill(0);
                return input => {
                    const dly = delay + depth * (Math.sin(phase += frequency) + 1);

                    let temp1 = dly - 0.5;
                    const f = Math.floor(temp1);
                    const frac = dly - f;

                    if (++index === buffer.length)
                        index = 0;

                    buffer[index] = input;

                    temp1 = index - f;
                    if (temp1 < 0)
                        temp1 = temp1 + buffer.length;
                    temp1 = buffer[Math.floor(temp1)];

                    let temp2 = index - f - 1;
                    if (temp2 < 0)
                        temp2 = temp2 + buffer.length;
                    temp2 = buffer[Math.floor(temp2)];

                    return (-1 * ((1 - frac) * temp1 + frac * temp2)) * wet + input * (1 - wet);
                };
            }
            const flangerStereo = [
                flanger1Ch(frequencyHz, delay0to1, depth0to1, wet, 0),
                flanger1Ch(frequencyHz, delay0to1, depth0to1, wet, stereoOffset * 2 * Math.PI),
            ]
            return (i, ch) => flangerStereo[ch](i)
		},

		compressor: (threshold, ratio, attackmillis, releasemillis) => {
            const compressor1Ch = (threshold, ratio, attackmillis, releasemillis) => {
                const attack = attackmillis / sampleRate;
                const release = releasemillis / sampleRate;
                let e = 0;
                return i => {
                    const ai = Math.abs(i);
                    e = e + ((e < 1) ? ((ai > threshold) ? attack : 0) : 0);
                    e = e - ((e > 0) ? ((ai < threshold) ? release : 0) : 0);
                    const g = 1 - e * ratio;
                    return i * g;
                };
            }
            const compressorStereo = [
                compressor1Ch(threshold, ratio, attackmillis, releasemillis),
                compressor1Ch(threshold, ratio, attackmillis, releasemillis)
            ]
            return (i, ch) => compressorStereo[ch](i)
		},
		amplify: gain => (x => x * gain),
        
        pan: leftToRightRatio => {
            return (input, ch, numCh) => {
                if (numCh === 1) return input
                if (ch === 0) {
                    const L = (1 - leftToRightRatio) * 2
                    return input * L
                }
                
                const R = leftToRightRatio * 2
                return input * R
            }
        },

		tremolo: (frequencyHz, depth) => {
			const frequency = frequencyHz / sampleRate * 2;
			let phase = 0;
			return (x, ch, total_n_ch) => {
                if (total_n_ch === 1 || ch === 1) {
                    if ((phase += frequency) >= 1)
                        phase -= 2;
                }
				return x * (1 - depth * Math.abs(phase));
			};
		},

		tone: (lowCutFreq0to1, highCutFreq0to1) => {
            if (highCutFreq0to1 < 0.001) highCutFreq0to1 = 0.001
            const tone1Ch = (lowCutFreq0to1, highCutFreq0to1) => {
                const cutConst = 0.3183099;
                const lpCutCalc = lowCutFreq0to1 / (cutConst + lowCutFreq0to1);
                const hpCutCalc = cutConst / (cutConst + highCutFreq0to1);
                let lpOut2 = 0;
                let hpOut2 = 0;
                let hpIn2 = 0;
                const lpProcess = x => {
                    lpOut2 = lpOut2 + lpCutCalc * (x - lpOut2);
                    return lpOut2
                };
                const hpProcess = x => {
                    hpOut2 = hpCutCalc * (x + hpOut2 - hpIn2);
                    hpIn2 = x;
                    return hpOut2;
                };

                return x => lpProcess(hpProcess(x));
            }
            const toneStereo = [tone1Ch(lowCutFreq0to1, highCutFreq0to1), tone1Ch(lowCutFreq0to1, highCutFreq0to1)]
            return (x, ch) => toneStereo[ch](x)
		}
	};
}

module.exports = { fx }