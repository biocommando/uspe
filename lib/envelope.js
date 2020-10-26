/*
 * Copyrights 2017 by Joonas Salonpää
 */

function createEnvelope(hasLength) {
	return {
		length: hasLength ? 0 : -1,
		phase: 0,
		ratio: 0,
		setLength: function(samples) {
			if(this.length >= 0 && samples >= 0) {
				this.length = samples;
			}
		},
		hasNext: function() {
			return this.length == -1 || this.phase < this.length;
		},
		reset: function() {
			this.phase = 0;
			this.ratio = 0;
		},
		calcuateNext: function() {
			if (++this.phase >= this.length)
			{
				this.phase = this.length;
				this.ratio = 1;
			}
			else
			{
				this.ratio = this.phase / this.length;
			}
		}
	};
}

function createAdsrEnvelope() {
	return {
		endReached: true,
		sustain: 0,
		stage: 0,
		releaseLevel: 0,
		envelope: 0,
		sampleRate: 44100,
		stages: [
			createEnvelope(true),
			createEnvelope(true),
			createEnvelope(false),
			createEnvelope(true)
		],
		setAttack: function(seconds) {
			this.stages[0].setLength(seconds * this.sampleRate);
		},
		setDecay: function(seconds) {
			this.stages[1].setLength(seconds * this.sampleRate);
		},
		setSustain: function(level) {
			this.sustain = level;
		},
		setRelease: function(seconds) {
			this.stages[3].setLength(seconds * this.sampleRate);
		},
		trigger: function() {
			this.endReached = false;
			this.triggerStage(0);
		},
		release: function() {
			if(this.stage >= 3) return;
			this.releaseLevel = this.envelope;
			this.triggerStage(3);
		},
		triggerStage: function(stage) {
			this.stage = stage;
			this.stages[stage].reset();
		},
		getRatio: function() {
			return this.stages[this.stage].ratio;
		},
		calculateNext: function() {
			if (this.endReached)	{
				return;
			}
			var current = this.stages[this.stage];
			if (current.hasNext())
			{
				current.calcuateNext();
				var ratio = current.ratio;
				switch (this.stage) {
					case 0:
						this.envelope = ratio;
						break;
					case 1:
						this.envelope = 1 - (1 - this.sustain) * ratio;
						break;
					case 2:
						this.envelope = this.sustain;
						break;
					case 3:
						this.envelope = this.releaseLevel * (1 - ratio);
						break;
					default:
						break;
				}
			}
			else if (this.stage < 3) {
				this.triggerStage(this.stage + 1);
				this.calculateNext();
			} else {
				// release ended
				this.envelope = 0;
				this.endReached = true;
			}
		}
	};
}



module.exports = {
    createAdsrEnvelope,
    getAdsrEnvelopeCreator: (attack, decay, sustain, release, sampleRate = 44100) => {
        let params = {attack, decay, sustain, release}
        return {
            create: (trigger = true) => {
                const env = createAdsrEnvelope()
                env.setAttack(params.attack)
                env.setDecay(params.decay)
                env.setSustain(params.sustain)
                env.setRelease(params.release)
                env.sampleRate = sampleRate
                if (trigger) {
                    env.trigger()
                }
                return env
            },
            getParams: () => params
        }
    }
}
