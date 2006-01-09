
var sbDataSource = {


	data : null,
	file : null,



	init : function(aQuietWarning)
	{
		try {
			this.file = sbCommonUtils.getScrapBookDir();
			this.file.append("scrapbook.rdf");
			if ( !this.file.exists() )
			{
				this.file.create(this.file.NORMAL_FILE_TYPE, 0666);
				var fileURL = sbCommonUtils.IO.newFileURI(this.file).spec;
				this.data = sbCommonUtils.RDF.GetDataSourceBlocking(fileURL);
				this.createEmptySeq("urn:scrapbook:root");
				this.flush();
			}
			else
			{
				var fileURL = sbCommonUtils.IO.newFileURI(this.file).spec;
				this.data = sbCommonUtils.RDF.GetDataSourceBlocking(fileURL);
			}
		}
		catch(ex) {
			if ( !aQuietWarning ) alert("ScrapBook ERROR: Failed to initialize datasource.\n\n" + ex);
		}
	},

	backup : function()
	{
		var bFile = sbCommonUtils.getScrapBookDir();
		bFile.append("backup");
		if ( !bFile.exists() ) bFile.create(bFile.DIRECTORY_TYPE, 0700);
		var bFileName = "scrapbook_" + sbCommonUtils.getTimeStamp().substring(0,8) + ".rdf";
		try {
			this.file.copyTo(bFile, bFileName);
			dump("sbDataSource::backup [" + bFileName + "]\n");
		} catch(ex) {
		}
	},

	flush : function()
	{
		this.data.QueryInterface(Components.interfaces.nsIRDFRemoteDataSource).Flush();
	},

	unregister : function()
	{
		sbCommonUtils.RDF.UnregisterDataSource(this.data);
	},



	sanitize : function(aVal)
	{
		aVal = aVal.replace(/[\x00-\x1F\x7F]/g, " ");
		return aVal.match(/^(<|>|&)/) ? (" " + aVal) : aVal;
	},

	addItem : function(aSBitem, aParName, aIdx)
	{
		aSBitem.title   = this.sanitize(aSBitem.title);
		aSBitem.comment = this.sanitize(aSBitem.comment);
		aSBitem.icon    = this.sanitize(aSBitem.icon);
		aSBitem.source  = this.sanitize(aSBitem.source);

		if ( aParName != "urn:scrapbook:root" && this.getProperty("type", sbCommonUtils.RDF.GetResource(aParName)) != "folder" )
		{
			alert("ScrapBook ERROR: Resource '" + aParName + "' is not found.");
			aParName = "urn:scrapbook:root"; aIdx = 0;
		}

		try {
			sbCommonUtils.RDFC.Init(this.data, sbCommonUtils.RDF.GetResource(aParName));
		}
		catch(ex) {
			alert("ScrapBook ERROR: Failed to initialize root container.\n\n" + ex);
			return false;
		}
		try {
			var newRes = sbCommonUtils.RDF.GetResource("urn:scrapbook:item" + aSBitem.id);
			this.data.Assert(newRes, sbCommonUtils.RDF.GetResource(NS_SCRAPBOOK + "id"),      sbCommonUtils.RDF.GetLiteral(aSBitem.id),      true);
			this.data.Assert(newRes, sbCommonUtils.RDF.GetResource(NS_SCRAPBOOK + "type"),    sbCommonUtils.RDF.GetLiteral(aSBitem.type),    true);
			this.data.Assert(newRes, sbCommonUtils.RDF.GetResource(NS_SCRAPBOOK + "title"),   sbCommonUtils.RDF.GetLiteral(aSBitem.title),   true);
			this.data.Assert(newRes, sbCommonUtils.RDF.GetResource(NS_SCRAPBOOK + "chars"),   sbCommonUtils.RDF.GetLiteral(aSBitem.chars),   true);
			this.data.Assert(newRes, sbCommonUtils.RDF.GetResource(NS_SCRAPBOOK + "comment"), sbCommonUtils.RDF.GetLiteral(aSBitem.comment), true);
			this.data.Assert(newRes, sbCommonUtils.RDF.GetResource(NS_SCRAPBOOK + "icon"),    sbCommonUtils.RDF.GetLiteral(aSBitem.icon),    true);
			this.data.Assert(newRes, sbCommonUtils.RDF.GetResource(NS_SCRAPBOOK + "source"),  sbCommonUtils.RDF.GetLiteral(aSBitem.source),  true);
			if ( aIdx > 0 ) {
				sbCommonUtils.RDFC.InsertElementAt(newRes, aIdx, true);
			} else {
				sbCommonUtils.RDFC.AppendElement(newRes);
			}
			this.flush();
			return newRes;
		}
		catch(ex) {
			alert("ScrapBook ERROR: Failed to add element to datasource.\n\n" + ex);
			return false;
		}
	},

	moveItem : function(curRes, curPar, tarPar, tarRelIdx)
	{
		try {
			sbCommonUtils.RDFC.Init(this.data, curPar);
			sbCommonUtils.RDFC.RemoveElement(curRes, true);
		} catch(ex) {
			alert("ScrapBook ERROR: Failed to move element at datasource (1).\n\n" + ex);
			return;
		}
		try {
			sbCommonUtils.RDFC.Init(this.data, tarPar);
			if ( tarRelIdx > 0 ) {
				sbCommonUtils.RDFC.InsertElementAt(curRes, tarRelIdx, true);
			} else {
				sbCommonUtils.RDFC.AppendElement(curRes);
			}
		}
		catch(ex) {
			alert("ScrapBook ERROR: Failed to move element at datasource (2).\n\n" + ex);
			sbCommonUtils.RDFC.Init(this.data, sbCommonUtils.RDF.GetResource("urn:scrapbook:root"));
			sbCommonUtils.RDFC.AppendElement(curRes, true);
		}
	},

	updateItem : function(aRes, aProp, newVal)
	{
		newVal = this.sanitize(newVal);
		try {
			aProp = sbCommonUtils.RDF.GetResource(NS_SCRAPBOOK + aProp);
			var oldVal = this.data.GetTarget(aRes, aProp, true);
			oldVal = oldVal.QueryInterface(Components.interfaces.nsIRDFLiteral);
			newVal = sbCommonUtils.RDF.GetLiteral(newVal);
			this.data.Change(aRes, aProp, oldVal, newVal);
		}
		catch(ex) {
			alert("ScrapBook ERROR: Failed to update element of datasource.\n" + ex);
		}
	},

	createEmptySeq : function(aResName)
	{
		sbCommonUtils.RDFCU.MakeSeq(this.data, sbCommonUtils.RDF.GetResource(aResName));
	},

	deleteItemDescending : function(aRes, aParRes)
	{
		sbCommonUtils.RDFC.Init(this.data, aParRes);
		sbCommonUtils.RDFC.RemoveElement(aRes, true);
		var rmIDs = addIDs = [];
		var depth = 0;
		do {
			addIDs = this.cleanUpIsolation();
			rmIDs = rmIDs.concat(addIDs);
		}
		while( addIDs.length > 0 && ++depth < 100 );
		return rmIDs;
	},

	cleanUpIsolation : function()
	{
		var rmIDs = [];
		try {
			var resEnum = this.data.GetAllResources();
			while ( resEnum.hasMoreElements() )
			{
				var aRes = resEnum.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
				if ( aRes.Value != "urn:scrapbook:root" && aRes.Value != "urn:scrapbook:search" && !this.data.ArcLabelsIn(aRes).hasMoreElements() )
				{
					rmIDs.push( this.removeResource(aRes) );
				}
			}
		}
		catch(ex) {
			alert("ScrapBook ERROR: Failed to clean up datasource.\n" + ex);
		}
		return rmIDs;
	},

	removeResource : function(aRes)
	{
		var names = this.data.ArcLabelsOut(aRes);
		var rmID = this.getProperty("id", aRes);
		while ( names.hasMoreElements() )
		{
			try {
				var name  = names.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
				var value = this.data.GetTarget(aRes, name, true);
				this.data.Unassert(aRes, name, value);
			}
			catch(ex) {
			}
		}
		return rmID;
	},



	getContainer : function(aResID, force)
	{
		var aCont = Components.classes['@mozilla.org/rdf/container;1'].createInstance(Components.interfaces.nsIRDFContainer);
		try {
			aCont.Init(this.data, sbCommonUtils.RDF.GetResource(aResID));
		} catch(ex) {
			return force ? sbCommonUtils.RDFCU.MakeSeq(this.data, sbCommonUtils.RDF.GetResource(aResID)) : null;
		}
		return aCont;
	},

	clearContainer : function(aResID)
	{
		var aCont = this.getContainer(aResID, true);
		while( aCont.GetCount() )
		{
			aCont.RemoveElementAt(1, true);
		}
	},

	removeElementFromContainer : function(aResID, aRes)
	{
		var aCont = this.getContainer(aResID, true);
		aCont.RemoveElement(aRes, true);
	},



	getProperty : function(aProp, aRes)
	{
		if ( aRes.Value == "urn:scrapbook:root" ) return "";
		try {
			var retVal = this.data.GetTarget(aRes, sbCommonUtils.RDF.GetResource(NS_SCRAPBOOK + aProp), true);
			return retVal.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
		}
		catch(ex) {
			return "";
		}
	},

	exists : function(aRes)
	{
		return this.data.ArcLabelsOut(aRes).hasMoreElements();
	},

	identify : function(aID)
	{
		var i = 0;
		while ( this.getProperty("id", sbCommonUtils.RDF.GetResource("urn:scrapbook:item" + aID)) && i < 100 )
		{
			aID = sbCommonUtils.getTimeStamp(--i);
			dump("*** ScrapBook IDENTIFY RESOURCE ID [" + i + "] " + aID + "\n");
		}
		return aID;
	},

	getRelativeIndex : function(aParRes, aRes)
	{
		return sbCommonUtils.RDFCU.indexOf(this.data, aParRes, aRes);
	},

	findContainerRes : function(aRes)
	{
		var ResList = this.data.GetAllResources();
		while ( ResList.hasMoreElements() )
		{
			var myRes = ResList.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
			if ( sbCommonUtils.RDFCU.IsContainer(this.data, myRes) == false ) continue;
			if ( myRes.Value == "urn:scrapbook:search" ) continue;
			if ( sbCommonUtils.RDFCU.indexOf(this.data, myRes, aRes) != -1 )
			{
				return myRes;
			}
		}
	},

};


