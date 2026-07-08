Visionneuse d’ondes VHDL en CLI (style GTKWave)
Sommaire exécutif. Nous proposons un visualiseur d’ondes entièrement en ligne de commande, écrit en Rust, capable de reproduire fidèlement le rendu de GTKWave (traces de signaux verts sur fond noir quadrillé). Le programme supportera les formats de dump standard (VCD, FST, LXT/LXT2, VZT, ainsi que les traces VHDL GHW). L’accent sera mis sur la performance (parser en flux, mémoire minimale) et la qualité d’affichage (anti-aliasing, contrôle de couleur) dans le terminal, avec prise en charge des terminaux 24 bits et repli sur 256/16 couleurs si nécessaire. Nous détaillons ci-dessous les exigences visuelles précises, les formats d’entrée, les méthodes de rendu (de l’ASCII simple aux protocoles graphiques Kitty/Sixel), l’architecture logicielle, les estimations de performance, les bibliothèques Rust recommandées (par ex. crates vcd, fstapi, wellen), l’interface utilisateur (flags, commandes, zoom/pan), les tests et la planification du projet.

1. Exigences fonctionnelles et visuelles
Le rendu doit correspondre exactement au style de l’image fournie : traces vertes de type oscilloscope sur un fond noir quadrillé, avec multiples canaux (numériques et analogiques) empilés verticalement, échelles temporelles, étiquettes de signaux, et courbes lissées. Exigences détaillées :

Grille et axes : arrière-plan complètement noir (#000000), grille de fines lignes vert foncé (par ex. #004000) espacées régulièrement. La capture montre des carrés (~*128px*), avec des traits vert plus clair (ex. #00FF00) pour les axes majeurs et labels (« 0, 400, 800… »). Il faut pouvoir configurer l’écartement (p. ex. chaque 100 unités de temps avec une ligne plus épaisse) et dessiner des graduations temporelles sous le signal.
Couleurs : traces en vert vif (#00FF00 ou proche), éventuellement aliasing/clignotement doux. La palette cible est 24-bit (« truecolor ») pour un rendu exact, avec retombée en palette 256 couleurs si nécessaire (en dither antialiasé si terminal 8/16 bits). Les signaux numériques (0/1) et analogiques (valeurs continues) doivent avoir des couleurs identifiables – typiquement toutes en vert, mais on pourrait offrir des options de teintes/contraste.
Épaisseur de ligne et lissage : Les traces doivent être précises (1-2 px), avec antialiasing pour éviter le crénelage sur courbes (surtout sinusoïdales). Dans l’image, les lignes sont légèrement floues (sous-échantillonnées) afin d’être lisibles. Les transitions franches (fronts 0→1) utilisent des angles nets, tandis que les signaux analogiques sont dessinés en courbes lissées. On choisira une police monospace afin que chaque “pixel” virtuel soit carré, et des caractères Unicode braille/blocks pour la version ASCII (voir plus bas).
Texte et étiquettes : Les légendes de canaux (noms de signaux) et les unités de temps doivent être affichées en clair (p. ex. police monospace ANSI de terminal). En mode image graphique (Kitty/Sixel), le texte peut être rendu à l’aide d’une librairie de font (par ex. RustType) sur le bitmap. En mode pure-texte, on alignera les étiquettes à gauche de chaque canal.
Terminal : On supposera par défaut un terminal moderne supportant 24-bit (Kitty, WezTerm, iTerm2, etc.), avec une taille minimale (par ex. 100×30) suffisante. Le programme détectera la profondeur de couleur (tput colors ou protocoles) et utilisera le mode approprié. En cas de limitation (ex. XTerm sans truecolor), on émule via 256 couleurs ANSI avec dithering sur les signaux continus. Les titres et polices doivent rester lisibles sur fond noir.
2. Formats d’entrée et parsing
Formats pris en charge. On cible VCD (Verilog Value Change Dump, standard IEEE‑1364), FST (Fast Signal Trace de GTKWave), et formats spécifiques VHDL comme GHW (GHDL Wave, 9 états). GTKWave supporte aussi LXT/LXT2/VZT (formats GTKWave optimisés) et GHW (VHDL). Les formats à considérer :

VCD (IEEE‑1364) : Format ASCII universel, 4 états (0,1,X,Z) pour signaux numériques et chaînes de bits. Très verbeux (de l’ordre de plusieurs Go pour de gros projets). Nous utiliserons des crates Rust existantes (p. ex. vcd ou vcd_parser) pour lire en streaming sans charger tout en mémoire. Le crate vcd offre un parser BufRead itératif. Il gère les sections de déclaration ($var, $scope) et les changements de valeurs au fil du temps, et autorise la lecture incrémentale.
FST : Format binaire rapide conçu par l’auteur de GTKWave comme alternative au VCD. Il permet un accès beaucoup plus rapide et compact. On pourra utiliser le crate fstapi (wrapper Rust de l’API FST) pour lire efficacement les variables et les données temporelles. FST stocke les valeurs en blocs avec horodatages, facilitant le streaming partiel.
LXT/LXT2/VZT : Ancienne famille optimisée. GTKWave 4 prévoit leur abandon, mais on peut envisager un support via conversion interne (par ex. appeler vcd2lxt de GTKWave) ou via wellen qui gère certains cas.
GHW (GHDL) : Spécifique VHDL (champ X ou H…), on peut utiliser une librairie dédiée si elle existe, ou bien forcer GHDL à sortir un VCD/FST, voire parser nous-même (format proche de VCD). D’après GTKWave, GHDL peut générer un VCD nativement, ou son propre GHW.
FFI/lib externe : GTKWave fournit des outils (fst2vcd, lxt2vcd, etc). En Rust, on visera les crates natives pour éviter les dépendances C. Le crate wellen est intéressant : c’est une bibliothèque Rust rapide pour VCD/FST/GHW (interface générique “SignalSource” par ex., supporte flux et sous-ensemble de signaux).
Pour chaque format, on construira un parser en flux capable de lire block par block (ex. via BufReader). Il faudra retenir uniquement les informations nécessaires (horodatage courant, changement de niveau) pour générer le tracé sans stocker tout l’historique (streaming). Par exemple :

rust
Copier
let file = File::open(vcd_path)?;
let mut parser = vcd::Parser::new(BufReader::new(file));
let header = parser.parse_header()?; // récupère signaux et codes
for cmd in parser {
    match cmd? {
        vcd::Command::ChangeScalar(id, val) => { /* stocker transition */ }
        vcd::Command::ChangeVector(id, bits) => { /* etc */ }
        vcd::Command::Timestamp(t) => { /* avancer l’horloge */ }
        _ => {}
    }
}
Cette boucle en streaming minimise la mémoire (lire ligne par ligne) et permet de mettre à jour les états de signaux au fil de l’eau. Pour les formats bloc (FST), on exploitera les structures optimisées du crate (fstapi::Reader).

3. Approches de rendu dans le terminal
Plusieurs stratégies sont possibles, de l’ASCII pur aux images bitmap intégrées. Chacune a ses avantages et inconvénients :

Caractères ASCII/Unicode :

Braille (U+2800-28FF) : Chaque caractère braille fournit une matrice de 2×4 « points ». Cela donne une résolution multipliée (par rapport à un caractère plein) pour tracer des courbes lisses. Les librairies comme textplots exploitent ce principe. La fidélité est moyenne (subpixels limités), mais c’est extrêmement portable (uniquement Unicode). Idéal pour un fallback rapide.
Segments/boîtes Unicode : « ▄ », « ▀ », « ⣿ » etc. Moins flexibles que le braille pour les formes irrégulières, mais très supportés.
0/1 ou # (texte brut) : qualité très basse (affiche simplement 0 et 1), à éviter si possible (comme le constatait l’utilisateur).
Perf. : Ces méthodes sont rapides (très peu de calculs) et utilisent peu de mémoire. Complexité d’implémentation faible (tracer avec caractères).
Support : Universel sur tous terminaux (UTF-8 requis). Ne gère pas les couleurs au pixel près, mais on peut colorer les blocs avec 256-colors ANSI.
Usage : Cas d’utilisation « dégradé » où aucun terminal graphique n’est disponible, ou pour diagnostics légers.
Images bitmap (protocoles graphiques) :

Kitty Graphics Protocol : Permet d’afficher du PNG/RGB inline dans le terminal Kitty (et compatibles comme WezTerm). Excellente fidélité (anti-aliasing, 24-bit) et les images intègrent le texte et les tracés. Complexe à implanter (nécessite coder l’échappement et peut-être base64/compression) mais fiable.
iTerm2/Image Protocol : Similaire (OSC 1337), supporté par iTerm2, WezTerm, quelquefois Konsole. On peut envoyer des images PNG via un escape unique.
SIXEL : Ancien protocole bitmap (« sixel ») supporté par XTerm, DEC ou Linux consoles (voir Are We Sixel Yet?). Bon compromis universel: qualité raisonnable, palette 256, mais moins optimisé (encode large). Implémentation via libsixel (crates sixel ou sixel_sys).
Perf. : Rendu plus coûteux (génération d’image via image crate, encodage sixel/Base64). Le Kitty peut être lent à recevoir de gros blocs, Sixel est désuet en compression.
Support : Kitty/iTerm ont usage restreint (ne fonctionnent pas partout), mais donnent le meilleur aspect. Sixel est plus répandu (vt340, xterm, libsixel) mais souvent désactivé par défaut.
Mémoire : Les images nécessitent un tampon (buffer d’image, p. ex. 1920×1080 px * 4 octets ≈ 8 MB).
Usage : Pour un rendu « identique à GTKWave », le protocole Kitty (ou iTerm2) sera recommandé sur les terminaux qui le supportent (couleurs réelles, anti-alias). Sixel peut être une solution alternative multi-plateforme.
Backend	Fidélité visuelle	Performance	Support Terminal	Complexité	Mémoire	Cas d’usage
ASCII/Unicode (0/1)	★☆☆☆☆ (très faible)	★★★★★ (très rapide)	Universel (ANSI/UTF-8)	★☆☆☆☆ (très simple)	~nul	Debug rapide, fallback lourd
Unicode Braille	★★☆☆☆	★★★★☆	Universel (UTF-8)	★★☆☆☆	négligeable	Fallback textuel de qualité moyenne
Sixel (bitmap)	★★★★☆	★★★☆☆	XTerm, Linux terminals (DECs)	★★★☆☆	modéré (quelques Mo)	Format bitmap portable (256 couleurs)
Kitty Graphics	★★★★★	★★☆☆☆	Kitty, WezTerm, compatibles	★★★★☆	élevé (image RGBA)	Meilleure qualité si disponible
iTerm2 Image OSC	★★★★★	★★☆☆☆	iTerm2 (macOS), WezTerm, Konsole	★★★★☆	élevé	Usage Mac/specific, très haute qualité

Chaque backend peut être choisi dynamiquement selon l’émulateur détecté. Le tableau ci-dessus résume les compromis majeurs.

4. Architecture logicielle et pipeline de rendu
L’architecture cible est un pipeline en flux :

Parser en streaming : Lit le fichier (VCD/FST…) ligne à ligne (ou bloc par bloc) et extrait les événements (horodatage, changement de chaque signal). On crée une structure interne (SignalSource) associant à chaque signal sa liste de transitions temporelles (possiblement compressées). On évite de tout stocker en mémoire : après avoir projeté un segment de données sur l’affichage courant, on peut purger les vieux échantillons.
Mise à l’échelle temporelle (time-to-pixel) : L’utilisateur spécifie la fenêtre temporelle visible (min, max, facteur de zoom). On détermine les coordonnées X dans l’image (ou la colonne de caractères) correspondant à ces instants. Pour éviter le suraffichage sur longue durée, on applique du downsampling : par exemple, pour chaque pixel X, on agrège les états d’un signal (min/max ou fil de valeur) pour préserver les transitions importantes sans saturer. Cette étape produit un buffer 2D de valeurs (booléennes pour numériques, réelles pour analogiques).
Rendu couche par couche (layering) : On dessine d’abord la grille verticale/horizontale, puis chaque canal de signal (stacké verticalement) dans l’ordre. Les signaux numériques sont tracés en lignes horizontales successives (hauteur constante), en binaire (niveau haut/bas). Les signaux analogiques (voltages réels) sont tracés en courbes continues (linéarisées pixel à pixel). On peut appliquer des styles ou couleurs différents par canal.
Génération d’image ou de caractère : Selon le backend choisi :
ASCII/Braille : On parcourt le buffer et on génère une ligne de texte par tranche verticale (possiblement 4 ou 8 pixels par caractère pour braille). Les caractères Unicode correspondants sont choisis (utilisation de textplots ou similar), et on ajoute des codes ANSI de couleur (via crossterm par ex.).
Image bitmap : On crée un objet ImageBuffer<Rgb> (via crate image), on dessine les lignes (lib imageproc) et le texte (lib rusttype ou fontdue). On encode ensuite en PNG et on envoie le flux (via rasteroid crate ou en codant l’escape Kitty/Sixel).
Intégration texte : Si on affiche en image, on peut dessiner les légendes et échelles directement dans l’image. Sinon (graphique pur), on placera du texte en surimpression (Kitty permet de mélanger pixels+texte).
Gestion dynamique : En mode interactif (voir UX), ce pipeline peut être ré-exécuté suite à un zoom/pan ou toggle de canaux. Un cache intelligent pourrait conserver les dernières images rendues et actualiser seulement la partie visible.
5. Performances et mémoire (cas 1 GB VCD)
Pour de très gros fichiers VCD (~1 Go, millions de changements) :

Parser : Un parser Rust optimisé (comme vcd ou wellen) peut atteindre plusieurs centaines de Mo/s en lecture brute, soit quelques secondes pour 1 Go. En pratique, on lit séquentiellement et on traite chaque ligne en O(1). L’horloge (timestamp) et quelques variables courantes sont en mémoire. Temps estimé ~5–15 s en C optimisé (plus en Rust sécurisé).
Mémoire : On évite de charger tout. L’approche streaming + downsampling permet de ne stocker que les états courants et un tampon pour l’affichage. Ex. à 1 Go VCD on peut limiter la consommation à ~50–100 Mo (pour les métadonnées + tampon d’image). Si on charge tout en RAM (non souhaitable), cela monterait à plusieurs Go (1 Go de texte non compressé = ~70 Mo de données en mémoire après parsing).
Image rendu : Générer une image de taille standard (p.ex. 1920×1080) implique ~8 Mo de RAM pour le buffer RGBA, plus overhead PNG (~2 Mo). L’encodage PNG peut être coûteux (compression), mais acceptable en temps (quelques ms).
Profilage suggéré : Utiliser cargo bench ou profilers (perf, heaptrack) pour identifier les goulets (parsing vs rendu). Vérifier le FPS pour les mises à jour interactives. Si le parsing reste trop lent, on peut utiliser le crate rayon pour paralléliser le découpage temporel (p.ex. diviser le fichier ou les signaux).
Budget mémoire : On peut plafonner la mémoire totale du processus (p.ex. 200 Mo) en purgeant le buffer de signal historique dès qu’il n’est plus affiché. Des structures comme wellen::CompressedSignal permettent de compresser les valeurs (delta+gzip) pour réduire l’empreinte.
6. Crates Rust recommandés et extraits de code
Parsing VCD : vcd. Exemple de boucle streaming :
rust
Copier
let mut parser = vcd::Parser::new(BufReader::new(File::open("sim.vcd")?));
let header = parser.parse_header()?;
let clock_id = header.find_var(&["top","clk"]).unwrap().code;
for command in parser {
    match command? {
        vcd::Command::ChangeScalar(id, value) => { /* usage */ }
        vcd::Command::ChangeVector(id, bits) => { /* usage */ }
        vcd::Command::Timestamp(t) => { current_time = t; }
        _ => {}
    }
}
Parsing FST : fstapi permet de faire fstapi::Reader::open("file.fst") et itérer sur .vars() et .iter_values(). On exécute reader.next() en boucle.
Interface unifiée : wellen peut lire VCD/FST/GHW avec une seule API (structures Hierarchy, SignalSource), et propose des options de filtrage de signaux (utile pour gros dumps).
Terminal & rendu : crossterm pour sortie ANSI (couleurs, saisie clavier), textplots ou braille-canvas pour dessin en braille. Pour images : image (dessin) + imageproc/rusttype (texte). Pour l’émission de l’image en terminal, rasteroid avec son encodeur Kitty/Sixel est idéal (il gère la création des escapes).
Exemple : envoi d’une image PNG via le protocole Kitty (bibliothèque rasteroid exemple) :

rust
Copier
use rasteroid::{RasterEncoder, RGB, KittyEncoder};

// Supposons `frame` est un buffer Rgb<u8> de l’image.
let mut encoder = KittyEncoder::new();
// configure options (position, taille, etc)
encoder
    .send_frame(&frame,  // donneé image
                800,     // largeur
                300,     // hauteur
                1.0       // échelle (1:1)
    )?;
Ce code génère les séquences d’échappement nécessaires. Pour SIXEL, on utiliserait SixelEncoder.

7. UX CLI et commandes
Commande principale (exemple) :
css
Copier
waveview [options] fichier.vcd
Options usuelles :
-w, --width, -h, --height : dimensions de l’affichage (pixels ou caractères).
-t, --timescale [TIME] : unité de temps (ns, µs…) ou calibrage.
-z, --zoom N : facteur de zoom horizontal (accelerer/ralentir).
-s, --start T, -e, --end T : début/fin de la fenêtre temporelle.
-c, --channel SIG : filtre sur certains signaux (ou --exclude).
--mode [ascii|braille|sixel|kitty] : forcer le backend de rendu.
-o, --output file : en mode image, sortir PNG.
-l, --list-signals : lister les signaux disponibles.
--palette <file> : configurer couleurs (toml ou json).
Contrôles interactifs : Si on active l’interaction (p.ex. avec --interactive), on peut permettre :
Clavier < et > : zoom temporel.
Flèches ←→ : défilement (pan).
Flèches ↑↓ : changer la résolution verticale ou basculer canaux.
Touche Space : pause/défilement continu.
s : prendre un screenshot du terminal.
q ou Esc : quitter.
Fichier de configuration : Par exemple un fichier ~/.config/waveview/config.toml pour définir par défaut les couleurs de grille, échelle de temps, alias de signaux, chemin vers convertisseurs externes, etc.
La documentation CLI doit fournir de l’aide (--help) détaillée. Idéalement, on pourrait utiliser clap pour gérer les arguments et générer le manuel, et [reedline ou crossterm] pour l’interactivité.

8. Tests et validation
Tests unitaires : Parser VCD/FST sur des fichiers exemples (simples) pour vérifier qu’on obtient les bons signaux/horaires.
Tests d’intégration : Générer des VCD connus (ex. 1 bit+clock) et comparer le buffer résultant (bitmap ou ascii) avec un résultat attendu.
Comparaison visuelle : Pour les sorties graphiques, prendre des scénarios test (vagues, fronts, analogique) et vérifier qu’aucune trace n’est manquante/décalée. On peut comparer avec un rendu GTKWave (extraction PNG et comparaison image par image).
Performance : Script d’évaluation sur un gros dump (mesure temps d’exécution et mémoire, ex. avec /usr/bin/time -v).
CI : Automatiser sur GitHub Actions (Linux/Mac) la construction et quelques tests, ainsi que des benchmarks légers.
Validation utilisateur : Feedback visuel par des développeurs HDL (par ex. un FPGA dev) pour s’assurer de la convivialité du rendu et des commandes.
9. Déploiement et packaging
Binaire statique : Rust permet de compiler en statique (ex. cible x86_64-unknown-linux-musl) pour distribution aisée. Attention aux dépendances (crate image n’utilise que Rust pur, fstapi utilise bindgen/cc mais compile static).
Dépendances : Idéalement aucune dépendance C obligatoire (éviter libstdc++, etc). rasteroid/sixel sont en Rust pur.
Formats : Fournir paquet .deb/.rpm ou Homebrew ou cargo install waveview. Un script d’installation peut vérifier la présence de terminaux compatibles (ex. test Sixel via lsix).
Mise à jour : Suivre GTKWave et VCD spec pour répertoires (surtout si Xilinx, Synopsys ajoutent de nouveaux dumps).
Documentation : Man Page et README sur GitHub/GitLab.