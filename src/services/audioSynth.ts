import * as Tone from 'tone';

class ManjiraSynth {
    private players: Tone.Players;
    private synth: Tone.MetalSynth | null = null;
    private initialized: boolean = false;
    private initResolver: (() => void) | null = null;
    private initializationPromise: Promise<void>;

    constructor() {
        const origin = window.location.origin;
        console.log(`ManjiraSynth: Initializing with origin ${origin}`);
        
        this.initializationPromise = new Promise((resolve) => {
            this.initResolver = resolve;
        });

        // Initialize players for custom MP3s
        this.players = new Tone.Players({
            urls: {
                OPEN: `${origin}/open_strike.mp3`,
                CLOSED: `${origin}/close_strike.mp3`
            },
            onload: () => {
                this.initialized = true;
                console.log("ManjiraSynth: All buffers loaded successfully");
                if (this.initResolver) this.initResolver();
            },
            onerror: (err) => {
                console.warn("ManjiraSynth: Custom MP3s failed to load, using synthesized fallback", err);
                this.setupSynthFallback();
                if (this.initResolver) this.initResolver();
            }
        }).toDestination();
    }

    private setupSynthFallback() {
        if (this.synth) return;
        
        this.synth = new Tone.MetalSynth({
            envelope: {
                attack: 0.001,
                decay: 1.4,
                release: 0.2
            },
            harmonicity: 5.1,
            modulationIndex: 32,
            resonance: 4000,
            octaves: 1.5
        }).toDestination();
        
        this.initialized = true;
        console.log("ManjiraSynth: Synthesized fallback initialized");
    }

    private async ensureInitialized() {
        if (this.initialized) return;
        return this.initializationPromise;
    }

    async prewarm() {
        await this.ensureInitialized();
    }

    async play(type: 'OPEN' | 'CLOSED') {
        try {
            // 1. Force context resume
            if (Tone.context.state !== 'running') {
                await Tone.start();
            }
            
            await this.ensureInitialized();

            const player = this.players.player(type);
            
            // If player is loaded and buffer is not empty (size > 0)
            if (player && player.loaded && player.buffer.length > 100) {
                player.start();
                console.log(`ManjiraSynth: Played MP3 ${type}`);
            } else {
                // Fallback to Synth
                if (!this.synth) this.setupSynthFallback();
                
                if (this.synth) {
                    if (type === 'OPEN') {
                        this.synth.envelope.decay = 1.2;
                        this.synth.triggerAttackRelease("C6", "32n");
                    } else {
                        this.synth.envelope.decay = 0.1;
                        this.synth.triggerAttackRelease("G6", "64n");
                    }
                    console.log(`ManjiraSynth: Played Synthesized ${type}`);
                }
            }
        } catch (err) {
            console.error(`ManjiraSynth: Playback failed for ${type}:`, err);
        }
    }
}

export const manjiraSynth = new ManjiraSynth();
