# Government biases

Each civilization gets one government it leans toward in its own age, so the computer players spread across the
economic systems instead of piling onto two or three (NOTES finding S). The rows are `GovernmentBiases` items in the
game's own AI lists, written by `data/econ-government-biases.sql` and loaded with the Economic systems option on.
Linking a civilization to a government is a gameplay choice for flavour and contrast, as DESIGN 4.17 says of the
systems, not a claim about how those states ran. Where a civilization's kit points somewhere, the pick follows it.

The game reads its AI lists when a game is created, so the rows reach new games only. Every row through `Traits` and `Governments`, so a civilization from a DLC you don't own, or a government an update renames,
skips its row and the game starts as usual. `tests/econ-government-biases.test.mjs` parses this table and the SQL and
checks they agree.

## Governments by age

| Age | Government | System (DESIGN 4.17) | How a civ gets it |
| --- | --- | --- | --- |
| Antiquity | Classical Republic | Civic market | the government screen |
| Antiquity | Despotism | Tribute | the government screen |
| Antiquity | Oligarchy | Merchant oligarchy | the government screen |
| Exploration | Feudal Monarchy | Manorial | the government screen |
| Exploration | Plutocracy | Mercantile | the government screen |
| Exploration | Theocracy | Religious | the government screen |
| Exploration | Constitutional Monarchy | Market | the Revolutions crisis event only |
| Exploration | Revolutionary Republic | Mixed | the Revolutions crisis event only |
| Exploration | Revolutionary Authoritarianism | Corporatist | the Revolutions crisis event only |
| Modern | Authoritarianism | Corporatist until an ideology | the government screen |
| Modern | Bureaucratic Monarchy | Corporatist until an ideology | the government screen |
| Modern | Elective Republic | Market until an ideology | the government screen |
| every age | Revolución | Mixed | Mexico's own, and the only one it can take |

The three crisis governments come from a narrative choice, not the government screen, so no civilization is pointed
at them. Revolución belongs to Mexico.

## The spread

| Age | Content | Civilizations | Governments | Systems |
| --- | --- | --- | --- | --- |
| Antiquity | every DLC | 17 | Classical Republic 6, Despotism 5, Oligarchy 6 | Civic market 6, Tribute 5, Merchant oligarchy 6 |
| Antiquity | base game only | 10 | Classical Republic 3, Despotism 4, Oligarchy 3 | Civic market 3, Tribute 4, Merchant oligarchy 3 |
| Exploration | every DLC | 18 | Feudal Monarchy 6, Plutocracy 6, Theocracy 6 | Manorial 6, Mercantile 6, Religious 6 |
| Exploration | base game only | 10 | Feudal Monarchy 3, Plutocracy 3, Theocracy 4 | Manorial 3, Mercantile 3, Religious 4 |
| Modern | every DLC | 15 | Authoritarianism 4, Bureaucratic Monarchy 5, Elective Republic 5, Revolución 1 | Corporatist 9, Market 5, Mixed 1 |
| Modern | base game only | 10 | Authoritarianism 3, Bureaucratic Monarchy 3, Elective Republic 3, Revolución 1 | Corporatist 6, Market 3, Mixed 1 |

Two of Modern's three governments run Corporatist, so an even spread of governments still leaves Corporatist the
largest system there. That lasts until a civilization takes an ideology, which then decides its system; in the probe
games the game spread the ideologies by itself. The picks spread evenly with every DLC and with the base game alone,
so a player without the DLC civilizations still sees the computer players split.

## Every civilization

"Game's row" is the base game's `GovernmentBiases` item for that civilization, with its value. "DLC" names the content
pack the civilization comes from; "base" is the base game.

| Civilization | Age | DLC | Game's row | Pick | System | Why |
| --- | --- | --- | --- | --- | --- | --- |
| Aksum | Antiquity | base | Oligarchy 25 | Oligarchy | Merchant oligarchy | Its kit is trade, with unlimited route range and an extra route each way, and Aksum minted gold coin for the Red Sea trade. |
| Assyria | Antiquity | assyria | Despotism 50 | Despotism | Tribute | It takes a technology and a codex from each settlement it captures, so expansion pays for itself. |
| Babylon | Antiquity | babylon | none | Classical Republic | Civic market | Its kit grows a city with each Food and Culture building, the happy, growing cities Civic market rewards, and Babylon's cities kept their citizen assemblies under the king. |
| Carthage | Antiquity | carthage | Despotism 25 | Oligarchy | Merchant oligarchy | Carthage was a republic run by its great trading families, and its kit doubles every Merchant it buys or trains. |
| Egypt | Antiquity | base | Oligarchy 25 | Despotism | Tribute | The pharaohs taxed the Nile's harvest, and its kit is production along the rivers rather than trade. |
| Gaul | Antiquity | gaul | none | Classical Republic | Civic market | Gallic peoples chose their magistrates in council, and its kit pays Gold to settlements that stand near other civs' borders. |
| Greece | Antiquity | base | Classical Republic 50 | Classical Republic | Civic market | Demokratia: Athens was run by its citizens, which is what citizen loans are built on. |
| Han | Antiquity | base | Despotism 50 | Despotism | Tribute | The Han taxed a centralized empire into its capital, and its kit grows the capital. |
| Heian | Antiquity | heian | Classical Republic 25, misspelt | Classical Republic | Civic market | The game meant Classical Republic, but its row names `GOVERNMENT_CLASSIC_REPUBLIC`, which doesn't exist; this puts the right name in. |
| Khmer | Antiquity | base | Oligarchy 25 | Oligarchy | Merchant oligarchy | Angkor's temple foundations held the land and the rice stores and ran the economy around them. |
| Maurya | Antiquity | base | Oligarchy 25 | Classical Republic | Civic market | Its kit puts Happiness on its buildings and heals its armies on a celebration, the meter citizen loans fill. |
| Maya | Antiquity | base | Despotism 25 | Despotism | Tribute | Maya kings drew tribute from the cities around them. |
| Mississippian | Antiquity | base | Oligarchy 50 | Oligarchy | Merchant oligarchy | Cahokia's chiefly lineages controlled the copper and shell trade along the rivers. |
| Persia | Antiquity | base | Despotism 50 | Despotism | Tribute | The satrapies paid tribute to the King of Kings, and its kit is about attacking. |
| Rome | Antiquity | base | Classical Republic 25 | Classical Republic | Civic market | Rome's citizens lent the Republic the fleet that won the First Punic War, DESIGN 4.17's example of citizen loans. |
| Silla | Antiquity | silla | none | Oligarchy | Merchant oligarchy | Silla's bone-rank nobles decided affairs in the Hwabaek council, and its kit trades with every ally. |
| Tonga | Antiquity | tonga | Oligarchy 25 | Oligarchy | Merchant oligarchy | Tonga's chiefly lines ran a sea-trade network, and its kit gets trade routes from city-states. |
| Abbasid | Exploration | base | Theocracy 50 | Theocracy | Religious | The caliph led both the faith and the state. |
| Bulgaria | Exploration | bulgaria | Feudal Monarchy 50 | Feudal Monarchy | Manorial | The tsars ruled through boyar landholders, and its kit lives off the countryside it pillages. |
| Chola | Exploration | base | Plutocracy 50 | Plutocracy | Mercantile | Chola merchant guilds traded across the Bay of Bengal, and its kit pays Gold and Influence on each trade route. |
| Dai Viet | Exploration | dai-viet | Feudal Monarchy 50 | Feudal Monarchy | Manorial | Its kit is fortifications and the armies that hold them, local strength over money. |
| England | Exploration | england | none | Plutocracy | Mercantile | Its kit trades Culture and Gold between its buildings, best on islands, and England grew rich on wool exports. |
| Goryeo | Exploration | goryeo | Feudal Monarchy 25 | Plutocracy | Mercantile | Goryeo sold celadon and ginseng through its port at Byeongnando, where Arab merchants carried its name west as Korea. |
| Hawaii | Exploration | base | Theocracy 50 | Theocracy | Religious | The chiefs ruled under the kapu, a religious law. |
| Iceland | Exploration | iceland | Feudal Monarchy 50 | Theocracy | Religious | Iceland's goðar were chieftains and priests at once, and its kit earns a Relic for each civic mastery. |
| Inca | Exploration | base | Theocracy 25 | Theocracy | Religious | The Sapa Inca ruled as the son of the Sun. |
| Majapahit | Exploration | base | Theocracy 25 | Theocracy | Religious | Majapahit's kings ruled as Hindu-Buddhist god-kings, and its kit builds Culture on the coast. |
| Ming | Exploration | base | Feudal Monarchy 25 | Feudal Monarchy | Manorial | The Ming ran the countryside through its landed gentry and a grain tax paid in kind. |
| Mongolia | Exploration | base | Feudal Monarchy 50 | Feudal Monarchy | Manorial | The khans shared out land and people among the princes, and its kit turns captured settlements into cavalry. |
| Norman | Exploration | base | Feudal Monarchy 50 | Feudal Monarchy | Manorial | Norman England is the textbook case of feudal landholding, and its kit is castles and coastal defence. |
| Pirate Republic | Exploration | pirate-republic | Feudal Monarchy 50 | Plutocracy | Mercantile | Nassau lived on selling plunder, and its kit pays GDP for sinking ships and moves treasure convoys freely. |
| Sengoku | Exploration | sengoku | Feudal Monarchy 50 | Feudal Monarchy | Manorial | The daimyo held land for the warriors who served them. |
| Shawnee | Exploration | shawnee-tecumseh | Feudal Monarchy 25 | Theocracy | Religious | Tenskwatawa, the Shawnee Prophet, led a religious revival from Prophetstown beside Tecumseh's confederacy. |
| Songhai | Exploration | base | Plutocracy 25 | Plutocracy | Mercantile | Its river cities traded gold and salt across the Sahara, and its kit adds resource capacity and treasure convoys. |
| Spain | Exploration | base | Feudal Monarchy 50 | Plutocracy | Mercantile | Spain's treasure fleets made it a bullion economy, and its kit pays Gold in Distant Lands. |
| America | Modern | base | Elective Republic 50 | Elective Republic | Market | An elected republic with a frontier economy, and its kit pays Gold for each resource it improves. |
| Buganda | Modern | base | Bureaucratic Monarchy 25 | Authoritarianism | Corporatist | Its kit is land armies that earn Culture by pillaging and cross the lakes, and the kabaka ruled a war state. |
| French Empire | Modern | base | Elective Republic 25 | Elective Republic | Market | Its kit can take any Modern government's celebrations, and France kept coming back to the Republic. |
| Great Britain | Modern | great-britain | Bureaucratic Monarchy 50 | Elective Republic | Market | Workshop of the World: its kit makes buildings cheaper to buy and build, and Britain led the free-trade era under Parliament. |
| Joseon | Modern | joseon | none | Bureaucratic Monarchy | Corporatist | Joseon was run by scholar-officials chosen by examination, and its kit is specialists and Seowon academies. |
| Meiji | Modern | base | Authoritarianism 50 | Elective Republic | Market | Meiji Japan wrote a constitution with an elected Diet, and its kit modernises by turning overbuilding into Science. |
| Mexico | Modern | base | none | Revolución | Mixed | Mexico starts in Revolución and can't take another government, so the row only states what already happens. |
| Mughal | Modern | base | Bureaucratic Monarchy 25 | Bureaucratic Monarchy | Corporatist | The mansabdars were a ranked imperial service, and its kit doubles Gold. |
| Nepal | Modern | nepal | Elective Republic 25 | Elective Republic | Market | Nepal's modern story ends in a federal republic. |
| Ottomans | Modern | ottomans | none | Authoritarianism | Corporatist | Its kit is infantry and siege on the attack, and the late empire was run by its army reformers. |
| Prussia | Modern | base | Authoritarianism 50 | Authoritarianism | Corporatist | Blood and Iron: a state built around its army. |
| Qajar | Modern | qajar | Bureaucratic Monarchy 50 | Bureaucratic Monarchy | Corporatist | The shahs ruled through a court bureaucracy, and its kit feeds the capital. |
| Qing | Modern | base | Bureaucratic Monarchy 25 | Bureaucratic Monarchy | Corporatist | The Qing ran the largest civil service of its day. |
| Russia | Modern | base | Authoritarianism 50 | Authoritarianism | Corporatist | Tsarist autocracy. |
| Siam | Modern | base | Bureaucratic Monarchy 50 | Bureaucratic Monarchy | Corporatist | The Chakri kings ran a court state that lived by its diplomacy, as its kit does. |

Every row is at 75. Thirty-one civilizations keep the government the game gave them, now at 75; eleven change
government; seven had no row of their own and get one; and Heian's misspelt row gets the right name. The reasoning for
the value is in NOTES.
