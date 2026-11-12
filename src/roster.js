/* BITZ roster: the custom Premier League 2026/27 squads (20 clubs x 11 main players + 25 bonus players)
   and 20 Champions League stars. Club assignments are intentional and are not updated to match real transfers.
   Every player: [name, position, nation, desirability, flags]. Flags: b = bonus player, y = young talent (Red Hot weighting).
   Desirability (D) is the value multiplier for every card of that player: squad 0.5-1.2, starter 1.2-2.6, star 3-8,
   superstar 10-25, icon 30-40. It is the only per-player number in the economy. */
export const SEASON = 'S2';
export const CLUBS = [
  ['arsenal', 'Arsenal', 'ARS', '#EF0107', '#FFFFFF', 'sleeves', [
    ['David Raya', 'GK', 'ESP', 2.2], ['William Saliba', 'DEF', 'FRA', 6], ['Gabriel Magalhaes', 'DEF', 'BRA', 4.5], ['Jurrien Timber', 'DEF', 'NED', 2.6], ['Riccardo Calafiori', 'DEF', 'ITA', 2.4],
    ['Declan Rice', 'MID', 'ENG', 7], ['Bruno Guimaraes', 'MID', 'BRA', 4.5], ['Martin Odegaard', 'MID', 'NOR', 7], ['Bukayo Saka', 'FWD', 'ENG', 16], ['Eberechi Eze', 'MID', 'ENG', 4.5], ['Viktor Gyokeres', 'FWD', 'SWE', 8],
    ['Kai Havertz', 'FWD', 'GER', 3.5, 'b'], ['Max Dowman', 'MID', 'ENG', 5, 'by']]],
  ['aston-villa', 'Aston Villa', 'AVL', '#670E36', '#95BFE5', 'plain', [
    ['Zion Suzuki', 'GK', 'JPN', 1.4], ['Matty Cash', 'DEF', 'POL', 1.2], ['Pau Torres', 'DEF', 'ESP', 1.8], ['Ian Maatsen', 'DEF', 'NED', 1.3], ['Victor Lindelof', 'DEF', 'SWE', 0.9],
    ['Boubacar Kamara', 'MID', 'FRA', 1.6], ['Joao Gomes', 'MID', 'BRA', 1.8], ['John McGinn', 'MID', 'SCO', 2.2], ['Emiliano Buendia', 'MID', 'ARG', 1.2], ['Alejandro Garnacho', 'FWD', 'ARG', 4], ['Nicolas Jackson', 'FWD', 'SEN', 3],
    ['Tammy Abraham', 'FWD', 'ENG', 1.4, 'b']]],
  ['bournemouth', 'AFC Bournemouth', 'BOU', '#DA291C', '#111111', 'stripes', [
    ['Djordje Petrovic', 'GK', 'SRB', 1.3], ['James Hill', 'DEF', 'ENG', 0.7], ['Antonio Silva', 'DEF', 'POR', 2.2], ['Adrien Truffert', 'DEF', 'FRA', 1.1], ['Adam Smith', 'DEF', 'ENG', 0.6],
    ['Tyler Adams', 'MID', 'USA', 1.4], ['Alex Scott', 'MID', 'ENG', 1.0], ['Marcus Tavernier', 'MID', 'ENG', 1.2], ['Justin Kluivert', 'FWD', 'NED', 2.2], ['Rayan', 'FWD', 'BRA', 2, 'y'], ['Evanilson', 'FWD', 'BRA', 2.2],
    ['Junior Kroupi', 'FWD', 'FRA', 1.5, 'by']]],
  ['brentford', 'Brentford', 'BRE', '#E30613', '#FFFFFF', 'stripes', [
    ['Caoimhin Kelleher', 'GK', 'IRL', 1.6], ['Michael Kayode', 'DEF', 'ITA', 1.1], ['Nathan Collins', 'DEF', 'IRL', 1.3], ['Kristoffer Ajer', 'DEF', 'NOR', 0.8], ['Rico Henry', 'DEF', 'ENG', 0.7],
    ['Vitaly Janelt', 'MID', 'GER', 0.9], ['Mamadou Sangare', 'MID', 'MLI', 0.7], ['Mikkel Damsgaard', 'MID', 'DEN', 1.6], ['Kevin Schade', 'FWD', 'GER', 1.6], ['Dango Ouattara', 'FWD', 'BFA', 1.4], ['Igor Thiago', 'FWD', 'BRA', 2.4],
    ['Keane Lewis-Potter', 'DEF', 'ENG', 1.0, 'b']]],
  ['brighton', 'Brighton & Hove Albion', 'BHA', '#0057B8', '#FFFFFF', 'stripes', [
    ['Bart Verbruggen', 'GK', 'NED', 1.8], ['Luka Vuskovic', 'DEF', 'CRO', 1.4, 'y'], ['Pascal Struijk', 'DEF', 'NED', 1.1], ['Maxim De Cuyper', 'DEF', 'BEL', 1.0], ['Ferdi Kadioglu', 'DEF', 'TUR', 1.0],
    ['Pascal Gross', 'MID', 'GER', 1.1], ['Mats Wieffer', 'MID', 'NED', 1.0], ['Diego Gomez', 'MID', 'PAR', 1.4], ['Kaoru Mitoma', 'FWD', 'JPN', 3.5], ['Yankuba Minteh', 'FWD', 'GAM', 2], ['Charalampos Kostoulas', 'FWD', 'GRE', 1.6, 'y'],
    ['Georginio Rutter', 'FWD', 'FRA', 1.5, 'b']]],
  ['chelsea', 'Chelsea', 'CHE', '#034694', '#FFFFFF', 'plain', [
    ['Emiliano Martinez', 'GK', 'ARG', 4], ['Reece James', 'DEF', 'ENG', 2.8], ['Wesley Fofana', 'DEF', 'FRA', 1.4], ['Levi Colwill', 'DEF', 'ENG', 2.4], ['Maxence Lacroix', 'DEF', 'FRA', 1.5],
    ['Moises Caicedo', 'MID', 'ECU', 6], ['Romeo Lavia', 'MID', 'BEL', 1.8], ['Morgan Rogers', 'MID', 'ENG', 4], ['Cole Palmer', 'MID', 'ENG', 18], ['Pedro Neto', 'FWD', 'POR', 2.8], ['Joao Pedro', 'FWD', 'BRA', 4],
    ['Estevao Willian', 'FWD', 'BRA', 9, 'by'], ['Geovany Quenda', 'FWD', 'POR', 4.5, 'by']]],
  ['coventry', 'Coventry City', 'COV', '#78D0F5', '#FFFFFF', 'plain', [
    ['Carl Rushworth', 'GK', 'ENG', 0.6], ['Milan van Ewijk', 'DEF', 'NED', 0.7], ['Bobby Thomas', 'DEF', 'ENG', 0.6], ['Ethan Pinnock', 'DEF', 'JAM', 0.7], ['Jay Dasilva', 'DEF', 'ENG', 0.5],
    ['Matt Grimes', 'MID', 'ENG', 0.7], ['Jack Rudoni', 'MID', 'ENG', 0.8], ['Gustavo Hamer', 'MID', 'BRA', 1.2], ['Ephron Mason-Clark', 'FWD', 'ENG', 0.7], ['Haji Wright', 'FWD', 'USA', 0.9], ['Ellis Simms', 'FWD', 'ENG', 0.8],
    ['Taiwo Awoniyi', 'FWD', 'NGA', 0.8, 'b']]],
  ['crystal-palace', 'Crystal Palace', 'CRY', '#1B458F', '#C4122E', 'stripes', [
    ['Dean Henderson', 'GK', 'ENG', 1.8], ['Chris Richards', 'DEF', 'USA', 1.3], ['Tyrick Mitchell', 'DEF', 'ENG', 1.2], ['Axel Disasi', 'DEF', 'FRA', 1.0], ['Oscar Mingueza', 'DEF', 'ESP', 1.0],
    ['Adam Wharton', 'MID', 'ENG', 3.5], ['Daichi Kamada', 'MID', 'JPN', 1.4], ['Quinten Timber', 'MID', 'NED', 1.2], ['Ismaila Sarr', 'FWD', 'SEN', 2], ['Yeremy Pino', 'FWD', 'ESP', 2], ['Jean-Philippe Mateta', 'FWD', 'FRA', 2.8],
    ['Jorgen Strand Larsen', 'FWD', 'NOR', 1.6, 'b']]],
  ['everton', 'Everton', 'EVE', '#003399', '#FFFFFF', 'plain', [
    ['Jordan Pickford', 'GK', 'ENG', 2.8], ["Jake O'Brien", 'DEF', 'IRL', 1.0], ['James Tarkowski', 'DEF', 'ENG', 1.3], ['Jarrad Branthwaite', 'DEF', 'ENG', 2.4], ['Vitalii Mykolenko', 'DEF', 'UKR', 0.9],
    ['James Garner', 'MID', 'ENG', 1.1], ['Kiernan Dewsbury-Hall', 'MID', 'ENG', 1.1], ['Hayden Hackney', 'MID', 'ENG', 1.0], ['Jack Grealish', 'MID', 'ENG', 4.5], ['Brennan Johnson', 'FWD', 'WAL', 1.6], ['Thierno Barry', 'FWD', 'FRA', 1.3],
    ['Tyler Dibling', 'FWD', 'ENG', 1.8, 'by']]],
  ['fulham', 'Fulham', 'FUL', '#FFFFFF', '#111111', 'plain', [
    ['Bernd Leno', 'GK', 'GER', 1.3], ['Kenny Tete', 'DEF', 'NED', 0.8], ['Joachim Andersen', 'DEF', 'DEN', 1.2], ['Calvin Bassey', 'DEF', 'NGA', 1.1], ['Antonee Robinson', 'DEF', 'USA', 1.6],
    ['Sander Berge', 'MID', 'NOR', 1.0], ['Alex Iwobi', 'MID', 'NGA', 1.5], ['Emile Smith Rowe', 'MID', 'ENG', 1.8], ['Oscar Bobb', 'FWD', 'NOR', 1.6, 'y'], ['Gonzalo Garcia', 'FWD', 'ESP', 1.8, 'y'], ['Rodrigo Muniz', 'FWD', 'BRA', 1.5],
    ['Hugo Larsson', 'MID', 'SWE', 1.2, 'b']]],
  ['hull', 'Hull City', 'HUL', '#F5A12D', '#111111', 'plain', [
    ['Konstantinos Tzolakis', 'GK', 'GRE', 0.8], ['Brooke Norton-Cuffy', 'DEF', 'ENG', 0.6], ['Semi Ajayi', 'DEF', 'NGA', 0.6], ['John Egan', 'DEF', 'IRL', 0.5], ['Ryan Giles', 'DEF', 'ENG', 0.5],
    ['Hidemasa Morita', 'MID', 'JPN', 0.9], ['Regan Slater', 'MID', 'ENG', 0.5], ['Eliot Matazo', 'MID', 'BEL', 0.6], ['Mohamed Belloumi', 'FWD', 'ALG', 0.7], ['Joe Gelhardt', 'FWD', 'ENG', 0.7], ['Oliver McBurnie', 'FWD', 'SCO', 0.7],
    ['Mohamed-Ali Cho', 'FWD', 'FRA', 0.9, 'b']]],
  ['ipswich', 'Ipswich Town', 'IPS', '#3A64A3', '#FFFFFF', 'plain', [
    ['Kjell Scherpen', 'GK', 'NED', 0.7], ['Darnell Furlong', 'DEF', 'ENG', 0.6], ['Issa Diop', 'DEF', 'FRA', 0.6], ["Dara O'Shea", 'DEF', 'IRL', 0.7], ['Leif Davis', 'DEF', 'ENG', 0.8],
    ['Sasa Lukic', 'MID', 'SRB', 0.7], ['Exequiel Palacios', 'MID', 'ARG', 1.4], ['Julio Enciso', 'MID', 'PAR', 1.3], ['Abdul Fatawu', 'FWD', 'GHA', 1.0], ['Jaden Philogene', 'FWD', 'ENG', 1.0], ['Daizen Maeda', 'FWD', 'JPN', 1.4],
    ['Jack Clarke', 'FWD', 'ENG', 0.8, 'b']]],
  ['leeds', 'Leeds United', 'LEE', '#FFFFFF', '#FFCD00', 'plain', [
    ['James Trafford', 'GK', 'ENG', 1.3], ['Jayden Bogle', 'DEF', 'ENG', 0.9], ['Joe Rodon', 'DEF', 'WAL', 0.9], ['Tarik Muharemovic', 'DEF', 'BIH', 0.7], ['Gabriel Gudmundsson', 'DEF', 'SWE', 0.7],
    ['Ethan Ampadu', 'MID', 'WAL', 1.0], ['Ao Tanaka', 'MID', 'JPN', 1.2], ['Anton Stach', 'MID', 'GER', 1.0], ['Harry Wilson', 'FWD', 'WAL', 1.1], ['Noah Okafor', 'FWD', 'SUI', 1.3], ['Dominic Calvert-Lewin', 'FWD', 'ENG', 1.3],
    ['Brenden Aaronson', 'MID', 'USA', 1.0, 'b']]],
  ['liverpool', 'Liverpool', 'LIV', '#C8102E', '#FFFFFF', 'plain', [
    ['Alisson Becker', 'GK', 'BRA', 5], ['Jeremie Frimpong', 'DEF', 'NED', 2.6], ['Virgil van Dijk', 'DEF', 'NED', 8], ['Ronald Araujo', 'DEF', 'URU', 2.6], ['Milos Kerkez', 'DEF', 'HUN', 1.8],
    ['Ryan Gravenberch', 'MID', 'NED', 4], ['Alexis Mac Allister', 'MID', 'ARG', 5], ['Dominik Szoboszlai', 'MID', 'HUN', 4], ['Florian Wirtz', 'MID', 'GER', 16], ['Bradley Barcola', 'FWD', 'FRA', 6], ['Alexander Isak', 'FWD', 'SWE', 14],
    ['Hugo Ekitike', 'FWD', 'FRA', 5, 'b'], ['Cody Gakpo', 'FWD', 'NED', 4, 'b']]],
  ['man-city', 'Manchester City', 'MCI', '#6CABDD', '#FFFFFF', 'plain', [
    ['Gianluigi Donnarumma', 'GK', 'ITA', 6], ['Ruben Dias', 'DEF', 'POR', 4], ['Marc Guehi', 'DEF', 'ENG', 3], ['Josko Gvardiol', 'DEF', 'CRO', 4], ['Rayan Ait-Nouri', 'DEF', 'ALG', 2],
    ['Enzo Fernandez', 'MID', 'ARG', 5], ['Elliot Anderson', 'MID', 'ENG', 3.5], ['Phil Foden', 'MID', 'ENG', 12], ['Rayan Cherki', 'MID', 'FRA', 5], ['Antoine Semenyo', 'FWD', 'GHA', 3.5], ['Erling Haaland', 'FWD', 'NOR', 32],
    ['Jeremy Doku', 'FWD', 'BEL', 4, 'b'], ['Iliman Ndiaye', 'FWD', 'SEN', 2, 'b']]],
  ['man-united', 'Manchester United', 'MUN', '#DA291C', '#111111', 'plain', [
    ['Senne Lammens', 'GK', 'BEL', 1.4], ['Diogo Dalot', 'DEF', 'POR', 1.6], ['Matthijs de Ligt', 'DEF', 'NED', 2.6], ['Lisandro Martinez', 'DEF', 'ARG', 2.6], ['Leny Yoro', 'DEF', 'FRA', 3],
    ['Bruno Fernandes', 'MID', 'POR', 8], ['Youri Tielemans', 'MID', 'BEL', 2], ['Carlos Baleba', 'MID', 'CMR', 3], ['Matheus Cunha', 'FWD', 'BRA', 4], ['Bryan Mbeumo', 'FWD', 'CMR', 4.5], ['Benjamin Sesko', 'FWD', 'SVN', 5],
    ['Amad Diallo', 'FWD', 'CIV', 3, 'b'], ['Kobbie Mainoo', 'MID', 'ENG', 3.5, 'by']]],
  ['newcastle', 'Newcastle United', 'NEW', '#241F20', '#FFFFFF', 'stripes', [
    ['Nick Pope', 'GK', 'ENG', 1.4], ['Tino Livramento', 'DEF', 'ENG', 2.2], ['Malick Thiaw', 'DEF', 'GER', 1.4], ['Sven Botman', 'DEF', 'NED', 1.6], ['Lewis Hall', 'DEF', 'ENG', 1.6],
    ['Joelinton', 'MID', 'BRA', 2.2], ['Nico Gonzalez', 'MID', 'ESP', 1.4], ['Jacob Ramsey', 'MID', 'ENG', 1.3], ['Harvey Barnes', 'FWD', 'ENG', 1.8], ['Anthony Elanga', 'FWD', 'SWE', 2.2], ['Yoane Wissa', 'FWD', 'COD', 2.2],
    ['Lewis Miley', 'MID', 'ENG', 1.3, 'by']]],
  ['nottingham', 'Nottingham Forest', 'NFO', '#DD0000', '#FFFFFF', 'plain', [
    ['Matz Sels', 'GK', 'BEL', 1.4], ['Ola Aina', 'DEF', 'NGA', 1.0], ['Nikola Milenkovic', 'DEF', 'SRB', 1.5], ['Murillo', 'DEF', 'BRA', 2.2], ['Neco Williams', 'DEF', 'WAL', 1.0],
    ['Ibrahim Sangare', 'MID', 'CIV', 0.8], ['James McAtee', 'MID', 'ENG', 1.4], ['Morgan Gibbs-White', 'MID', 'ENG', 4], ['Callum Hudson-Odoi', 'FWD', 'ENG', 1.4], ['Dan Ndoye', 'FWD', 'SUI', 1.8], ['Liam Delap', 'FWD', 'ENG', 2.2],
    ['Chris Wood', 'FWD', 'NZL', 1.6, 'b']]],
  ['sunderland', 'Sunderland', 'SUN', '#EB172B', '#FFFFFF', 'stripes', [
    ['Robin Roefs', 'GK', 'NED', 0.9], ['Trai Hume', 'DEF', 'NIR', 0.8], ['Daniel Ballard', 'DEF', 'NIR', 0.8], ['Nordi Mukiele', 'DEF', 'FRA', 1.0], ['Reinildo', 'DEF', 'MOZ', 0.8],
    ['Granit Xhaka', 'MID', 'SUI', 2.2], ['Enzo Le Fee', 'MID', 'FRA', 1.3], ['Habib Diarra', 'MID', 'SEN', 1.3], ['Chemsdine Talbi', 'FWD', 'MAR', 1.1], ['Malick Fofana', 'FWD', 'BEL', 1.6, 'y'], ['Brian Brobbey', 'FWD', 'NED', 1.3],
    ['Chris Rigg', 'MID', 'ENG', 1.4, 'by']]],
  ['tottenham', 'Tottenham Hotspur', 'TOT', '#FFFFFF', '#132257', 'plain', [
    ['Antonin Kinsky', 'GK', 'CZE', 1.0], ['Pedro Porro', 'DEF', 'ESP', 2], ['Jan Paul van Hecke', 'DEF', 'NED', 1.3], ['Micky van de Ven', 'DEF', 'NED', 3], ['Andrew Robertson', 'DEF', 'SCO', 1.8],
    ['Sandro Tonali', 'MID', 'ITA', 5], ['Lucas Bergvall', 'MID', 'SWE', 2.4, 'y'], ['Xavi Simons', 'MID', 'NED', 5], ['Mohammed Kudus', 'FWD', 'GHA', 3.5], ['Omar Marmoush', 'FWD', 'EGY', 3.5], ['Dominic Solanke', 'FWD', 'ENG', 2.4],
    ['Mathys Tel', 'FWD', 'FRA', 1.8, 'by']]]
];
/* the 20 Champions League stars: premium collectibles, not an album. [name, pos, nation, D, club id, flags] */
export const EURO_CLUBS = [
  ['real-madrid', 'Real Madrid', 'RMA', '#FFFFFF', '#FEBE10', 'plain'],
  ['barcelona', 'FC Barcelona', 'BAR', '#A50044', '#004D98', 'stripes'],
  ['bayern', 'Bayern Munich', 'BAY', '#DC052D', '#FFFFFF', 'plain'],
  ['psg', 'Paris Saint-Germain', 'PSG', '#004170', '#DA291C', 'sash'],
  ['atletico', 'Atletico Madrid', 'ATM', '#CB3524', '#FFFFFF', 'stripes'],
  ['inter', 'Inter Milan', 'INT', '#010E80', '#111111', 'stripes']
];
export const UCL_STARS = [
  ['Kylian Mbappe', 'FWD', 'FRA', 40, 'real-madrid'], ['Lamine Yamal', 'FWD', 'ESP', 40, 'barcelona', 'y'], ['Vinicius Junior', 'FWD', 'BRA', 22, 'real-madrid'], ['Jude Bellingham', 'MID', 'ENG', 24, 'real-madrid'],
  ['Harry Kane', 'FWD', 'ENG', 18, 'bayern'], ['Ousmane Dembele', 'FWD', 'FRA', 18, 'psg'], ['Jamal Musiala', 'MID', 'GER', 16, 'bayern'], ['Raphinha', 'FWD', 'BRA', 12, 'barcelona'],
  ['Pedri', 'MID', 'ESP', 14, 'barcelona'], ['Khvicha Kvaratskhelia', 'FWD', 'GEO', 10, 'psg'], ['Rodri', 'MID', 'ESP', 10, 'man-city'], ['Michael Olise', 'FWD', 'FRA', 9, 'bayern'],
  ['Julian Alvarez', 'FWD', 'ARG', 10, 'atletico'], ['Lautaro Martinez', 'FWD', 'ARG', 9, 'inter'], ['Arda Guler', 'MID', 'TUR', 9, 'real-madrid', 'y'], ['Desire Doue', 'FWD', 'FRA', 10, 'psg', 'y'],
  ['Achraf Hakimi', 'DEF', 'MAR', 9, 'psg'], ['Trent Alexander-Arnold', 'DEF', 'ENG', 8, 'real-madrid'], ['Federico Valverde', 'MID', 'URU', 9, 'real-madrid'], ['Luis Diaz', 'FWD', 'COL', 7, 'bayern']
];
