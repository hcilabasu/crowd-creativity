class Matrix:
	def __init__(self):
		self.rows = []

	def add_row(self, row):
		self.rows.append(row)

	def __str__(self):
		str = ''
		for r in rows:
			str += str(r)
		return str

class Row:
	def __init__(self):
		self.cells = []

	def add_cell(self, cell):
		self.cells.append(cell)

	def __str__(self):
		template = '<tr>%s</tr>'
		str = ''
		for c in self.cells:
			str += template % (str(c))
		return str

class Cell:
	def __init__(self, is_header = False, value = 0):
		self.is_header = is_header
		self.value = value

	def __str__(self):
		type = 'h' if self.is_header else 'd'
		template = '<t%s style="%s">%s</%s>' % (type, '%s', '%s', type)
		style = '' if self.is_header else 'background: rgb(%d,%d,255)' % (100, 100)
		content = value if self.is_header else ' '
		return template % (style, content)

